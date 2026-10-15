import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import onig from 'vscode-oniguruma';
import tm from 'vscode-textmate';

test('migoto syntax highlights section headers with inline comments', async () => {
  const wasm = fs.readFileSync('node_modules/vscode-oniguruma/release/onig.wasm').buffer;
  await onig.loadWASM(wasm);

  const rawGrammar = fs.readFileSync('upstream/syntaxes/migoto.tmLanguage.json', 'utf8');

  const registry = new tm.Registry({
    onigLib: Promise.resolve({
      createOnigScanner: onig.createOnigScanner,
      createOnigString: onig.createOnigString,
    }),
    loadGrammar: async (scope) => {
      if (scope === 'source.migoto') {
        return tm.parseRawGrammar(rawGrammar, 'migoto.json');
      }
      return null;
    },
  });

  const grammar = await registry.loadGrammar('source.migoto');
  assert.ok(grammar, 'Grammar should be loaded');

  // Test 1: TextureOverride section with inline comment
  const line1 = '[TextureOverridec4a81184] ; Diffuse';
  const res1 = grammar.tokenizeLine(line1, tm.INITIAL);
  const openBracket1 = res1.tokens.find((t) => line1.slice(t.startIndex, t.endIndex) === '[');
  const sectionName1 = res1.tokens.find((t) => line1.slice(t.startIndex, t.endIndex) === 'TextureOverridec4a81184');
  const closeBracket1 = res1.tokens.find((t) => line1.slice(t.startIndex, t.endIndex) === ']');
  const commentToken1 = res1.tokens.find((t) => line1.slice(t.startIndex, t.endIndex).includes('Diffuse'));

  assert.ok(openBracket1?.scopes.includes('punctuation.definition.entity.begin.migoto'));
  assert.ok(sectionName1?.scopes.includes('entity.name.class.migoto'));
  assert.ok(closeBracket1?.scopes.includes('punctuation.definition.entity.end.migoto'));
  assert.ok(commentToken1?.scopes.includes('comment.line.semicolon.migoto'));

  // Test 2: Resource section with inline comment
  const line2 = '[ResourceDiffuse] ; Diffuse DDS';
  const res2 = grammar.tokenizeLine(line2, tm.INITIAL);
  const sectionName2 = res2.tokens.find((t) => line2.slice(t.startIndex, t.endIndex) === 'ResourceDiffuse');
  const commentToken2 = res2.tokens.find((t) => line2.slice(t.startIndex, t.endIndex).includes('Diffuse DDS'));

  assert.ok(sectionName2?.scopes.includes('entity.name.section.group-title.migoto'));
  assert.ok(commentToken2?.scopes.includes('comment.line.semicolon.migoto'));

  // Test 3: Constants section with inline comment
  const line3 = '[Constants] ; Global Vars';
  const res3 = grammar.tokenizeLine(line3, tm.INITIAL);
  const sectionName3 = res3.tokens.find((t) => line3.slice(t.startIndex, t.endIndex) === 'Constants');
  const commentToken3 = res3.tokens.find((t) => line3.slice(t.startIndex, t.endIndex).includes('Global Vars'));

  assert.ok(sectionName3?.scopes.includes('entity.name.constructor.migoto'));
  assert.ok(commentToken3?.scopes.includes('comment.line.semicolon.migoto'));
});
