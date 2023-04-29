
import walk from './walk.js';

function error(...args) {
  throw import('pug/modules/error').apply(null, args);
}

export default link;
function link(ast) {
  console.assert(
    ast.type === 'Block',
    'The top level element should always be a block'
  );
  let extendsNode = null;
  if (ast.nodes.length) {
    const hasExtends = ast.nodes[0].type === 'Extends';
    checkExtendPosition(ast, hasExtends);
    if (hasExtends) {
      extendsNode = ast.nodes.shift();
    }
  }
  ast = applyIncludes(ast);
  ast.declaredBlocks = findDeclaredBlocks(ast);
  if (extendsNode) {
    const mixins = [];
    const expectedBlocks = [];
    ast.nodes.forEach(function addNode(node) {
      if (node.type === 'NamedBlock') {
        expectedBlocks.push(node);
      } else if (node.type === 'Block') {
        node.nodes.forEach(addNode);
      } else if (node.type === 'Mixin' && node.call === false) {
        mixins.push(node);
      } else {
        error(
          'UNEXPECTED_NODES_IN_EXTENDING_ROOT',
          'Only named blocks and mixins can appear at the top level of an extending template',
          node
        );
      }
    });
    const parent = link(extendsNode.file.ast);
    extend(parent.declaredBlocks, ast);
    const foundBlockNames = [];
    walk(parent, ({type, name}) => {
      if (type === 'NamedBlock') {
        foundBlockNames.push(name);
      }
    });
    expectedBlocks.forEach(expectedBlock => {
      if (!foundBlockNames.includes(expectedBlock.name)) {
        error(
          'UNEXPECTED_BLOCK',
          `Unexpected block ${expectedBlock.name}`,
          expectedBlock
        );
      }
    });
    Object.keys(ast.declaredBlocks).forEach(name => {
      parent.declaredBlocks[name] = ast.declaredBlocks[name];
    });
    parent.nodes = mixins.concat(parent.nodes);
    parent.hasExtends = true;
    return parent;
  }
  return ast;
}

function findDeclaredBlocks(ast) /*: {[name: string]: Array<BlockNode>}*/ {
  const definitions = {};
  walk(ast, function before(node) {
    if (node.type === 'NamedBlock' && node.mode === 'replace') {
      definitions[node.name] = definitions[node.name] || [];
      definitions[node.name].push(node);
    }
  });
  return definitions;
}

function flattenParentBlocks(parentBlocks, accumulator = []) {
  parentBlocks.forEach(parentBlock => {
    if (parentBlock.parents) {
      flattenParentBlocks(parentBlock.parents, accumulator);
    }
    accumulator.push(parentBlock);
  });
  return accumulator;
}

function extend(parentBlocks, ast) {
  const stack = {};
  walk(
    ast,
    function before(node) {
      if (node.type === 'NamedBlock') {
        if (stack[node.name] === node.name) {
          return (node.ignore = true);
        }
        stack[node.name] = node.name;
        const parentBlockList = parentBlocks[node.name]
          ? flattenParentBlocks(parentBlocks[node.name])
          : [];
        if (parentBlockList.length) {
          node.parents = parentBlockList;
          parentBlockList.forEach(parentBlock => {
            switch (node.mode) {
              case 'append':
                parentBlock.nodes = parentBlock.nodes.concat(node.nodes);
                break;
              case 'prepend':
                parentBlock.nodes = node.nodes.concat(parentBlock.nodes);
                break;
              case 'replace':
                parentBlock.nodes = node.nodes;
                break;
            }
          });
        }
      }
    },
    function after(node) {
      if (node.type === 'NamedBlock' && !node.ignore) {
        delete stack[node.name];
      }
    }
  );
}

function applyIncludes(ast, child) {
  return walk(
    ast,
    function before(node, replace) {
      if (node.type === 'RawInclude') {
        replace({type: 'Text', val: node.file.str.replace(/\r/g, '')});
      }
    },
    function after(node, replace) {
      if (node.type === 'Include') {
        let childAST = link(node.file.ast);
        if (childAST.hasExtends) {
          childAST = removeBlocks(childAST);
        }
        replace(applyYield(childAST, node.block));
      }
    }
  );
}
function removeBlocks(ast) {
  return walk(ast, ({type, nodes}, replace) => {
    if (type === 'NamedBlock') {
      replace({
        type: 'Block',
        nodes: nodes,
      });
    }
  });
}

function applyYield(ast, block) {
  if (!block || !block.nodes.length) return ast;
  let replaced = false;
  ast = walk(ast, null, (node, replace) => {
    if (node.type === 'YieldBlock') {
      replaced = true;
      node.type = 'Block';
      node.nodes = [block];
    }
  });
  function defaultYieldLocation(node) {
    let res = node;
    for (let i = 0; i < node.nodes.length; i++) {
      if (node.nodes[i].textOnly) continue;
      if (node.nodes[i].type === 'Block') {
        res = defaultYieldLocation(node.nodes[i]);
      } else if (node.nodes[i].block && node.nodes[i].block.nodes.length) {
        res = defaultYieldLocation(node.nodes[i].block);
      }
    }
    return res;
  }
  if (!replaced) {
    // todo: probably should deprecate this with a warning
    defaultYieldLocation(ast).nodes.push(block);
  }
  return ast;
}

function checkExtendPosition(ast, hasExtends) {
  let legitExtendsReached = false;
  walk(ast, node => {
    if (node.type === 'Extends') {
      if (hasExtends && !legitExtendsReached) {
        legitExtendsReached = true;
      } else {
        error(
          'EXTENDS_NOT_FIRST',
          'Declaration of template inheritance ("extends") should be the first thing in the file. There can only be one extends statement per file.',
          node
        );
      }
    }
  });
}
