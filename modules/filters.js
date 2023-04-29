import {path } from './fs.js';
const { dirname} = path;
import constantinople from './constantinople.js';
import walk from './walk.js';
import { makeError as error }from './error.js';
import runFilter from './run-filter.js';
import jstransformer from 'jstransformer';
import resolve from 'resolve';

export function handleFilters(ast, filters, options = {}, filterAliases) {
  walk(
    ast,
    node => {
      const dir = node.filename ? dirname(node.filename) : null;
      if (node.type === 'Filter') {
        handleNestedFilters(node, filters, options, filterAliases);
        const text = getBodyAsText(node);
        var attrs = getAttributes(node, options);
        attrs.filename = node.filename;
        node.type = 'Text';
        node.val = filterWithFallback(node, text, attrs);
      } else if (node.type === 'RawInclude' && node.filters.length) {
        const firstFilter = node.filters.pop();
        var attrs = getAttributes(firstFilter, options);
        const filename = (attrs.filename = node.file.fullPath);
        node.type = 'Text';
        node.val = filterFileWithFallback(
          firstFilter,
          filename,
          node.file,
          attrs
        );
        node.filters
          .slice()
          .reverse()
          .forEach(filter => {
            const attrs = getAttributes(filter, options);
            attrs.filename = filename;
            node.val = filterWithFallback(filter, node.val, attrs);
          });
        node.filters = undefined;
        node.file = undefined;
      }

      function filterWithFallback(filter, text, attrs, funcName) {
        try {
          const filterName = getFilterName(filter);
          if (filters && filters[filterName]) {
            return filters[filterName](text, attrs);
          } else {
            return runFilter(filterName, text, attrs, dir, funcName);
          }
        } catch (ex) {
          if (ex.code === 'UNKNOWN_FILTER') {
            throw error(ex.code, ex.message, filter);
          }
          throw ex;
        }
      }

      function filterFileWithFallback(filter, filename, {raw, str}, attrs) {
        const filterName = getFilterName(filter);
        if (filters && filters[filterName]) {
          if (filters[filterName].renderBuffer) {
            return filters[filterName].renderBuffer(raw, attrs);
          } else {
            return filters[filterName](str, attrs);
          }
        } else {
          return filterWithFallback(filter, filename, attrs, 'renderFile');
        }
      }
    },
    {includeDependencies: true}
  );
  function getFilterName(filter) {
    let filterName = filter.name;
    if (filterAliases && filterAliases[filterName]) {
      filterName = filterAliases[filterName];
      if (filterAliases[filterName]) {
        throw error(
          'FILTER_ALISE_CHAIN',
          `The filter "${filter.name}" is an alias for "${filterName}", which is an alias for "${filterAliases[filterName]}".  Pug does not support chains of filter aliases.`,
          filter
        );
      }
    }
    return filterName;
  }
  return ast;
}

function handleNestedFilters({block}, filters, options, filterAliases) {
  if (block.nodes[0] && block.nodes[0].type === 'Filter') {
    block.nodes[0] = handleFilters(
      block,
      filters,
      options,
      filterAliases
    ).nodes[0];
  }
}

function getBodyAsText({block}) {
  return block.nodes
    .map(({val}) => val)
    .join('');
}

function getAttributes(node, options) {
  const attrs = {};
  node.attrs.forEach(({name, val}) => {
    try {
      attrs[name] =
        val === true ? true : constantinople.toConstant(val);
    } catch (ex) {
      if (/not constant/.test(ex.message)) {
        throw error(
          'FILTER_OPTION_NOT_CONSTANT',
          `${ex.message} All filters are rendered compile-time so filter options must be constants.`,
          node
        );
      }
      throw ex;
    }
  });
  const opts = options[node.name] || {};
  Object.keys(opts).forEach(opt => {
    if (!attrs.hasOwnProperty(opt)) {
      attrs[opt] = opts[opt];
    }
  });
  return attrs;
}


function getMinifyTransformerName(outputFormat) {
  switch (outputFormat) {
    case 'js':
      return 'uglify-js';
    case 'css':
      return 'clean-css';
  }
}

export function runFilter(name, str, options, currentDirectory, funcName = 'render') {
  let trPath;
  try {
    try {
      trPath = resolve.sync(`jstransformer-${name}`, {
        basedir: currentDirectory || process.cwd(),
      });
    } catch (ex) {
      trPath = require.resolve(`jstransformer-${name}`);
    }
  } catch (ex) {
    const err = new Error(`unknown filter ":${name}"`);
    err.code = 'UNKNOWN_FILTER';
    throw err;
  }
  const tr = jstransformer(require(trPath));
  // TODO: we may want to add a way for people to separately specify "locals"
  let result = tr[funcName](str, options, options).body;
  if (options && options.minify) {
    const minifyTranformer = getMinifyTransformerName(tr.outputFormat);
    if (minifyTranformer) {
      try {
        result = filter(minifyTranformer, result, null, currentDirectory);
      } catch (ex) {
        // better to fail to minify than output nothing
      }
    }
  }
  return result;
}