
import test from 'testit';
import parser from './character-parser.js';
const parse = parser.parse;
const TOKEN_TYPES = parser.TOKEN_TYPES;

test('parse', () => {
  test('works out how much depth changes', () => {
    const state = parse('foo(arg1, arg2, {\n  foo: [a, b\n');
    assert.deepEqual(state.stack, [ TOKEN_TYPES.ROUND_BRACKET, TOKEN_TYPES.CURLY_BRACKET, TOKEN_TYPES.SQUARE_BRACKET ]);

    parse('    c, d]\n  })', state);
    assert.deepEqual(state.stack, []);
  });
});

test('parseUntil', () => {
  test('finds contents of bracketed expressions with specified bracket', () => {
    var section = parser.parseUntil('foo="(", bar="}"] bing bong', ']');
    console.assert(section.start === 0);
    console.assert(section.end === 16);//exclusive end of string
    console.assert(section.src === 'foo="(", bar="}"');

    var section = parser.parseUntil('foo="(", bar="}")] bing bong', ')');
    console.assert(section.start === 0);
    console.assert(section.end === 16);//exclusive end of string
    console.assert(section.src === 'foo="(", bar="}"');
  });
  test('finds code up to a custom delimiter', () => {
    var section = parser.parseUntil('foo.bar("%>").baz%> bing bong', '%>');
    console.assert(section.start === 0);
    console.assert(section.end === 17);//exclusive end of string
    console.assert(section.src === 'foo.bar("%>").baz');

    var section = parser.parseUntil('<%foo.bar("%>").baz%> bing bong', '%>', {start: 2});
    console.assert(section.start === 2);
    console.assert(section.end === 19);//exclusive end of string
    console.assert(section.src === 'foo.bar("%>").baz');

    var section = parser.parseUntil('x = `foo${`)`}`)', ')');
    assert.deepEqual(section, {
      start: 0,
      end: 15,
      src: 'x = `foo${`)`}`'
    });

    var section = parser.parseUntil('x = `foo${`)`}`])', /^[\])]/);
    assert.deepEqual(section, {
      start: 0,
      end: 15,
      src: 'x = `foo${`)`}`'
    });

    try {
      var section = parser.parseUntil('x = `foo${)}`)', ')');
    } catch (ex) {
      console.assert(ex.code === 'CHARACTER_PARSER:MISMATCHED_BRACKET');
      return;
    }
    throw new Error('Expected mismatched brackets');
  });
});

test('regressions', () => {
  test('#1', () => {
    test('parses regular expressions', () => {
      var section = parser.parseUntil('foo=/\\//g, bar="}") bing bong', ')');
      console.assert(section.start === 0);
      console.assert(section.end === 18);//exclusive end of string
      console.assert(section.src === 'foo=/\\//g, bar="}"');

      var section = parser.parseUntil('foo = typeof /\\//g, bar="}") bing bong', ')');
      console.assert(section.start === 0);
      //console.assert(section.end === 18);//exclusive end of string
      console.assert(section.src === 'foo = typeof /\\//g, bar="}"');
    })
  })
  test('#6', () => {
    test('parses block comments', () => {
      var section = parser.parseUntil('/* ) */) bing bong', ')');
      console.assert(section.start === 0);
      console.assert(section.end === 7);//exclusive end of string
      console.assert(section.src === '/* ) */');
      var section = parser.parseUntil('/* /) */) bing bong', ')');
      console.assert(section.start === 0);
      console.assert(section.end === 8);//exclusive end of string
      console.assert(section.src === '/* /) */');
    })
  })
})