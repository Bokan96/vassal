/**
 * Exports every player-facing text (UI strings, tutorial steps, rules dialog) as JSON, pairing the
 * Serbian and English versions, for the translation editor.
 *
 *   npm run texts -- out.json
 *
 * The dev server also serves it to the local translation editor (tools/prevodi/, see texts-plugin.ts).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

type Kind = 'text' | 'template' | 'code';

export interface TextEntry {
  id: string;
  group: string;
  label: string;
  kind: Kind;
  sr?: string;
  en?: string;
  hint?: string;
  file: string;
  line: number;
}

interface Side {
  kind: Kind;
  text: string;
  line: number;
}

let root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parse(path: string): ts.SourceFile {
  const file = resolve(root, path);
  return ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
}

const lineOf = (sf: ts.SourceFile, node: ts.Node) =>
  sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

function unwrap(e: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e)) {
    e = e.expression;
  }
  return e;
}

function propName(p: ts.ObjectLiteralElementLike, sf: ts.SourceFile): string {
  const n = p.name;
  if (!n) return '?';
  if (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n)) return n.text;
  return n.getText(sf);
}

// ---------------------------------------------------------------------------------------------
// i18n.ts
// ---------------------------------------------------------------------------------------------

function exportI18n(out: TextEntry[]) {
  const path = 'src/ui/i18n.ts';
  const sf = parse(path);
  const consts = new Map<string, ts.Expression>();
  let dict: ts.InterfaceDeclaration | undefined;
  for (const st of sf.statements) {
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.initializer) consts.set(d.name.text, d.initializer);
      }
    }
    if (ts.isInterfaceDeclaration(st) && st.name.text === 'Dict') dict = st;
  }

  // Section headings ("// Start screen") and doc comments from the Dict interface.
  const groupOf = new Map<string, string>();
  const hintOf = new Map<string, string>();
  let group = 'General';
  for (const m of dict?.members ?? []) {
    const text = sf.text;
    for (const c of ts.getLeadingCommentRanges(text, m.getFullStart()) ?? []) {
      const body = text.slice(c.pos, c.end);
      if (body.startsWith('//')) group = body.slice(2).trim();
      else
        hintOf.set(m.name?.getText(sf) ?? '', squash(body.replace(/^\/\*\*?|\*\/$|^\s*\*/gm, '')));
    }
    groupOf.set(m.name?.getText(sf) ?? '', group);
  }

  const sides = new Map<string, { sr?: Side; en?: Side }>();
  const put = (id: string, lang: 'sr' | 'en', side: Side) => {
    const s = sides.get(id) ?? {};
    s[lang] = side;
    sides.set(id, s);
  };

  // Shared helpers handled once, so properties that merely point at them are skipped.
  const HELPERS: { id: string; group: string; label: string; en?: string; sr?: string }[] = [
    { id: 'names', group: 'Players', label: 'Player names', en: 'enName', sr: 'srName' },
    {
      id: 'namesGenitive',
      group: 'Players',
      label: 'Player names, genitive (Serbian only)',
      sr: 'srGen',
    },
    { id: 'ranks', group: 'Cards and tiers', label: 'Card ranks', en: 'EN_RANKS', sr: 'SR_RANKS' },
  ];
  const helperNames = new Set(HELPERS.flatMap((h) => [h.en, h.sr]).filter(Boolean));

  function walk(prefix: string, e: ts.Expression, lang: 'sr' | 'en') {
    e = unwrap(e);
    const line = lineOf(sf, e);
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
      put(prefix, lang, { kind: 'text', text: e.text, line });
    } else if (ts.isTemplateExpression(e)) {
      put(prefix, lang, { kind: 'template', text: e.getText(sf).slice(1, -1), line });
    } else if (ts.isObjectLiteralExpression(e)) {
      for (const p of e.properties) {
        if (ts.isPropertyAssignment(p)) walk(`${prefix}.${propName(p, sf)}`, p.initializer, lang);
      }
    } else if (ts.isArrayLiteralExpression(e)) {
      e.elements.forEach((el, i) => walk(`${prefix}.${i}`, el, lang));
    } else if (ts.isArrowFunction(e) && !ts.isBlock(e.body)) {
      const body = unwrap(e.body);
      if (
        ts.isElementAccessExpression(body) &&
        ts.isObjectLiteralExpression(unwrap(body.expression))
      ) {
        walk(prefix, body.expression, lang);
      } else if (ts.isTemplateExpression(body) || ts.isStringLiteral(body)) {
        walk(prefix, body, lang);
      } else {
        put(prefix, lang, { kind: 'code', text: squash(body.getText(sf)), line });
      }
    } else if (ts.isIdentifier(e) && consts.has(e.text) && !helperNames.has(e.text)) {
      walk(prefix, consts.get(e.text)!, lang);
    } else if (!ts.isIdentifier(e)) {
      put(prefix, lang, { kind: 'code', text: squash(e.getText(sf)), line });
    }
  }

  for (const h of HELPERS) {
    if (h.en) walk(h.id, consts.get(h.en)!, 'en');
    if (h.sr) walk(h.id, consts.get(h.sr)!, 'sr');
  }
  for (const lang of ['en', 'sr'] as const) {
    const obj = unwrap(consts.get(lang)!);
    if (!ts.isObjectLiteralExpression(obj)) continue;
    for (const p of obj.properties) {
      if (!ts.isPropertyAssignment(p)) continue;
      const name = propName(p, sf);
      if (name === 'lang') continue;
      walk(name, p.initializer, lang);
    }
  }

  for (const [id, s] of sides) {
    const top = id.split('.')[0]!;
    const helper = HELPERS.find((h) => h.id === top);
    const kind: Kind =
      s.sr?.kind === 'code' || s.en?.kind === 'code'
        ? 'code'
        : s.sr?.kind === 'template' || s.en?.kind === 'template'
          ? 'template'
          : 'text';
    out.push({
      id,
      group: helper?.group ?? groupOf.get(top) ?? 'General',
      label: helper ? `${helper.label}: ${id.slice(top.length + 1)}` : id,
      kind,
      sr: s.sr?.text,
      en: s.en?.text,
      hint: hintOf.get(top),
      file: path,
      line: s.sr?.line ?? s.en!.line,
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Tutorial steps
// ---------------------------------------------------------------------------------------------

function exportTutorial(out: TextEntry[]) {
  const path = 'src/ui/tutorial/script.ts';
  const sf = parse(path);
  sf.forEachChild(function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'TUTORIAL_STEPS' &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      node.initializer.elements.forEach((step, i) => {
        if (!ts.isObjectLiteralExpression(step)) return;
        const text = step.properties.find(
          (p): p is ts.PropertyAssignment =>
            ts.isPropertyAssignment(p) && propName(p, sf) === 'text',
        );
        if (!text || !ts.isObjectLiteralExpression(text.initializer)) return;
        const get = (lang: string) => {
          const p = text.initializer as ts.ObjectLiteralExpression;
          const v = p.properties.find(
            (q) => ts.isPropertyAssignment(q) && propName(q, sf) === lang,
          );
          return v && ts.isPropertyAssignment(v) && ts.isStringLiteralLike(v.initializer)
            ? v.initializer.text
            : undefined;
        };
        out.push({
          id: `tutorial.${i + 1}`,
          group: 'Tutorial',
          label: `Step ${i + 1}`,
          kind: 'text',
          sr: get('sr'),
          en: get('en'),
          hint: '**bold** marks emphasis in the tutorial bubble.',
          file: path,
          line: lineOf(sf, step),
        });
      });
    }
    node.forEachChild(visit);
  });
}

// ---------------------------------------------------------------------------------------------
// Rules dialog (JSX). Paired by section (each <h3> starts one), then by position in the section.
// ---------------------------------------------------------------------------------------------

function exportRules(out: TextEntry[]) {
  const path = 'src/ui/components/RulesDialog.tsx';
  const sf = parse(path);
  const BLOCKS = new Set(['p', 'h3', 'li']);
  const collect = (fn: string) => {
    const items: { section: number; index: number; text: string; line: number }[] = [];
    let section = 0;
    let index = 0;
    sf.forEachChild(function visit(node): void {
      if (ts.isFunctionDeclaration(node) && node.name?.text !== fn) return;
      if (ts.isJsxElement(node)) {
        const tag = node.openingElement.tagName.getText(sf);
        if (BLOCKS.has(tag)) {
          if (tag === 'h3') {
            section++;
            index = 0;
          }
          const inner = node.children
            .map((c) => sf.text.slice(c.pos, c.end))
            .join('')
            .replace(/\{' '\}/g, ' ');
          items.push({ section, index: index++, text: squash(inner), line: lineOf(sf, node) });
          return;
        }
      }
      node.forEachChild(visit);
    });
    return items;
  };
  const en = collect('RulesEn');
  const sr = collect('RulesSr');
  const keys = new Set([...sr, ...en].map((x) => `${x.section}.${x.index}`));
  for (const k of [...keys].sort((a, b) => {
    const [as, ai] = a.split('.').map(Number);
    const [bs, bi] = b.split('.').map(Number);
    return as! - bs! || ai! - bi!;
  })) {
    const s = sr.find((x) => `${x.section}.${x.index}` === k);
    const e = en.find((x) => `${x.section}.${x.index}` === k);
    const [section, index] = k.split('.').map(Number);
    out.push({
      id: `rules.${k}`,
      group: 'Rules',
      label:
        section === 0
          ? `Intro ${index! + 1}`
          : `Section ${section}, ${index === 0 ? 'heading' : `item ${index}`}`,
      kind: 'text',
      sr: s?.text,
      en: e?.text,
      hint: 'Inline tags such as <strong>…</strong> are kept.',
      file: path,
      line: (s ?? e)!.line,
    });
  }
}

/** Every text, in display order. `projectRoot` defaults to the repository this script lives in. */
export function exportTexts(projectRoot = root): TextEntry[] {
  root = projectRoot;
  const entries: TextEntry[] = [];
  exportI18n(entries);
  exportTutorial(entries);
  exportRules(entries);
  return entries;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const entries = exportTexts();
  const target = process.argv[2];
  const json = JSON.stringify({ exportedAt: new Date().toISOString(), entries }, null, 1);
  if (target) {
    writeFileSync(target, json);
    console.log(`${entries.length} texts → ${relative(process.cwd(), target)}`);
  } else {
    console.log(json);
  }
}
