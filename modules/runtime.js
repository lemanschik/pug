const pug_has_own_property = Object.prototype.hasOwnProperty;

const runtime = {
    merge: pug_merge,
    classes: pug_classes,
    style: pug_style,
    attr: pug_attr,
    attrs: pug_attrs,
    escape: pug_escape,
    rethrow: pug_rethrow,
}

export function build(functions) {
    const fns = [];
    functions = functions.filter(fn => !({
        "dependencies": true,
        "internals": true,
        "has_own_property": true,
        "classes_array": true,
        "classes_object": true,
        "match_html": true
      })[fn]);
    for (let i = 0; i < functions.length; i++) {
      if (!fns.includes(functions[i])) {
        fns.push(functions[i]);
        functions.push(...({
          "has_own_property": [],
          "merge": [
            "style"
          ],
          "classes_array": [
            "classes",
            "escape"
          ],
          "classes_object": [
            "has_own_property"
          ],
          "classes": [
            "classes_array",
            "classes_object"
          ],
          "style": [
            "has_own_property"
          ],
          "attr": [
            "escape"
          ],
          "attrs": [
            "attr",
            "classes",
            "has_own_property",
            "style"
          ],
          "match_html": [],
          "escape": [
            "match_html"
          ],
          "rethrow": []
        })[functions[i]]);
      }
    }
    return fns
      .sort()
      .map(name => ({
      "has_own_property": "var pug_has_own_property=Object.prototype.hasOwnProperty;",
      "merge": "function pug_merge(e,r){if(1===arguments.length){for(var t=e[0],g=1;g<e.length;g++)t=pug_merge(t,e[g]);return t}for(var l in r)if(\"class\"===l){var n=e[l]||[];e[l]=(Array.isArray(n)?n:[n]).concat(r[l]||[])}else if(\"style\"===l){var n=pug_style(e[l]);n=n&&\";\"!==n[n.length-1]?n+\";\":n;var a=pug_style(r[l]);a=a&&\";\"!==a[a.length-1]?a+\";\":a,e[l]=n+a}else e[l]=r[l];return e}",
      "classes_array": "function pug_classes_array(r,a){for(var s,e=\"\",u=\"\",c=Array.isArray(a),g=0;g<r.length;g++)(s=pug_classes(r[g]))&&(c&&a[g]&&(s=pug_escape(s)),e=e+u+s,u=\" \");return e}",
      "classes_object": "function pug_classes_object(r){var a=\"\",n=\"\";for(var o in r)o&&r[o]&&pug_has_own_property.call(r,o)&&(a=a+n+o,n=\" \");return a}",
      "classes": "function pug_classes(s,r){return Array.isArray(s)?pug_classes_array(s,r):s&&\"object\"==typeof s?pug_classes_object(s):s||\"\"}",
      "style": "function pug_style(r){if(!r)return\"\";if(\"object\"==typeof r){var t=\"\";for(var e in r)pug_has_own_property.call(r,e)&&(t=t+e+\":\"+r[e]+\";\");return t}return r+\"\"}",
      "attr": "function pug_attr(t,e,n,r){if(!1===e||null==e||!e&&(\"class\"===t||\"style\"===t))return\"\";if(!0===e)return\" \"+(r?t:t+'=\"'+t+'\"');var f=typeof e;return\"object\"!==f&&\"function\"!==f||\"function\"!=typeof e.toJSON||(e=e.toJSON()),\"string\"==typeof e||(e=JSON.stringify(e),n||-1===e.indexOf('\"'))?(n&&(e=pug_escape(e)),\" \"+t+'=\"'+e+'\"'):\" \"+t+\"='\"+e.replace(/'/g,\"&#39;\")+\"'\"}",
      "attrs": "function pug_attrs(t,r){var a=\"\";for(var s in t)if(pug_has_own_property.call(t,s)){var u=t[s];if(\"class\"===s){u=pug_classes(u),a=pug_attr(s,u,!1,r)+a;continue}\"style\"===s&&(u=pug_style(u)),a+=pug_attr(s,u,!1,r)}return a}",
      "match_html": "var pug_match_html=/[\"&<>]/;",
      "escape": "function pug_escape(e){var a=\"\"+e,t=pug_match_html.exec(a);if(!t)return e;var r,c,n,s=\"\";for(r=t.index,c=0;r<a.length;r++){switch(a.charCodeAt(r)){case 34:n=\"&quot;\";break;case 38:n=\"&amp;\";break;case 60:n=\"&lt;\";break;case 62:n=\"&gt;\";break;default:continue}c!==r&&(s+=a.substring(c,r)),c=r+1,s+=n}return c!==r?s+a.substring(c,r):s}",
      "rethrow": "function pug_rethrow(e,n,r,t){if(!(e instanceof Error))throw e;if(!(\"undefined\"==typeof window&&n||t))throw e.message+=\" on line \"+r,e;var o,a,i,s;try{t=t||require(\"fs\").readFileSync(n,{encoding:\"utf8\"}),o=3,a=t.split(\"\\n\"),i=Math.max(r-o,0),s=Math.min(a.length,r+o)}catch(t){return e.message+=\" - could not read from \"+n+\" (\"+t.message+\")\",void pug_rethrow(e,null,r)}o=a.slice(i,s).map(function(e,n){var t=n+i+1;return(t==r?\"  > \":\"    \")+t+\"| \"+e}).join(\"\\n\"),e.path=n;try{e.message=(n||\"Pug\")+\":\"+r+\"\\n\"+o+\"\\n\\n\"+e.message}catch(e){}throw e}"
    })[name])
      .join('\n');
  }

export async function wrap(template, templateName) {
    templateName = templateName || 'template';
    return Function(
      'pug',
      template + '\n' + 'return ' + templateName + ';'
    )(runtime);
  }

/**
 * Merge two attribute objects giving precedence
 * to values in object `b`. Classes are special-cased
 * allowing for arrays and merging/joining appropriately
 * resulting in a string.
 *
 * @param {Object} a
 * @param {Object} b
 * @return {Object} a
 * @api private
 */

export {pug_merge as merge};

function pug_merge(a, b) {
  if (arguments.length === 1) {
    let attrs = a[0];
    for (let i = 1; i < a.length; i++) {
      attrs = pug_merge(attrs, a[i]);
    }
    return attrs;
  }

  for (const key in b) {
    if (key === 'class') {
      var valA = a[key] || [];
      a[key] = (Array.isArray(valA) ? valA : [valA]).concat(b[key] || []);
    } else if (key === 'style') {
      var valA = pug_style(a[key]);
      valA = valA && valA[valA.length - 1] !== ';' ? `${valA};` : valA;
      let valB = pug_style(b[key]);
      valB = valB && valB[valB.length - 1] !== ';' ? `${valB};` : valB;
      a[key] = valA + valB;
    } else {
      a[key] = b[key];
    }
  }

  return a;
}

/**
 * Process array, object, or string as a string of classes delimited by a space.
 *
 * If `val` is an array, all members of it and its subarrays are counted as
 * classes. If `escaping` is an array, then whether or not the item in `val` is
 * escaped depends on the corresponding item in `escaping`. If `escaping` is
 * not an array, no escaping is done.
 *
 * If `val` is an object, all the keys whose value is truthy are counted as
 * classes. No escaping is done.
 *
 * If `val` is a string, it is counted as a class. No escaping is done.
 *
 * @param {(Array.<string>|Object.<string, boolean>|string)} val
 * @param {?Array.<string>} escaping
 * @return {String}
 */
export {pug_classes as classes};

function pug_classes_array(val, escaping) {
  let classString = '';
  let className;
  let padding = '';
  const escapeEnabled = Array.isArray(escaping);
  for (let i = 0; i < val.length; i++) {
    className = pug_classes(val[i]);
    if (!className) continue;
    escapeEnabled && escaping[i] && (className = pug_escape(className));
    classString = classString + padding + className;
    padding = ' ';
  }
  return classString;
}
function pug_classes_object(val) {
  let classString = '', padding = '';
  for (const key in val) {
    if (key && val[key] && pug_has_own_property.call(val, key)) {
      classString = classString + padding + key;
      padding = ' ';
    }
  }
  return classString;
}
function pug_classes(val, escaping) {
  if (Array.isArray(val)) {
    return pug_classes_array(val, escaping);
  } else if (val && typeof val === 'object') {
    return pug_classes_object(val);
  } else {
    return val || '';
  }
}

/**
 * Convert object or string to a string of CSS styles delimited by a semicolon.
 *
 * @param {(Object.<string, string>|string)} val
 * @return {String}
 */

export {pug_style as style};

function pug_style(val) {
  if (!val) return '';
  if (typeof val === 'object') {
    let out = '';
    for (const style in val) {
      /* istanbul ignore else */
      if (pug_has_own_property.call(val, style)) {
        out = `${out + style}:${val[style]};`;
      }
    }
    return out;
  } else {
    return `${val}`;
  }
}

/**
 * Render the given attribute.
 *
 * @param {String} key
 * @param {String} val
 * @param {Boolean} escaped
 * @param {Boolean} terse
 * @return {String}
 */
export {pug_attr as attr};

function pug_attr(key, val, escaped, terse) {
  if (
    val === false ||
    val == null ||
    (!val && (key === 'class' || key === 'style'))
  ) {
    return '';
  }
  if (val === true) {
    return ` ${terse ? key : `${key}="${key}"`}`;
  }
  const type = typeof val;
  if (
    (type === 'object' || type === 'function') &&
    typeof val.toJSON === 'function'
  ) {
    val = val.toJSON();
  }
  if (typeof val !== 'string') {
    val = JSON.stringify(val);
    if (!escaped && val.includes('"')) {
      return ` ${key}='${val.replace(/'/g, '&#39;')}'`;
    }
  }
  if (escaped) val = pug_escape(val);
  return ` ${key}="${val}"`;
}

/**
 * Render the given attributes object.
 *
 * @param {Object} obj
 * @param {Object} terse whether to use HTML5 terse boolean attributes
 * @return {String}
 */
export {pug_attrs as attrs};

function pug_attrs(obj, terse) {
  let attrs = '';

  for (const key in obj) {
    if (pug_has_own_property.call(obj, key)) {
      let val = obj[key];

      if ('class' === key) {
        val = pug_classes(val);
        attrs = pug_attr(key, val, false, terse) + attrs;
        continue;
      }
      if ('style' === key) {
        val = pug_style(val);
      }
      attrs += pug_attr(key, val, false, terse);
    }
  }

  return attrs;
}

/**
 * Escape the given string of `html`.
 *
 * @param {String} html
 * @return {String}
 * @api private
 */

const pug_match_html = /["&<>]/;
export {pug_escape as escape};
function pug_escape(_html) {
  const html = `${_html}`;
  const regexResult = pug_match_html.exec(html);
  if (!regexResult) return _html;

  let result = '';
  let i, lastIndex, escape;
  for (i = regexResult.index, lastIndex = 0; i < html.length; i++) {
    switch (html.charCodeAt(i)) {
      case 34:
        escape = '&quot;';
        break;
      case 38:
        escape = '&amp;';
        break;
      case 60:
        escape = '&lt;';
        break;
      case 62:
        escape = '&gt;';
        break;
      default:
        continue;
    }
    if (lastIndex !== i) result += html.substring(lastIndex, i);
    lastIndex = i + 1;
    result += escape;
  }
  if (lastIndex !== i) return result + html.substring(lastIndex, i);
  else return result;
}

/**
 * Re-throw the given `err` in context to the
 * the pug in `filename` at the given `lineno`.
 *
 * @param {Error} err
 * @param {String} filename
 * @param {String} lineno
 * @param {String} str original source
 * @api private
 */

export {pug_rethrow as rethrow};

function pug_rethrow(err, filename, lineno, str) {
  if (!(err instanceof Error)) throw err;
  if ((typeof window != 'undefined' || !filename) && !str) {
    err.message += ` on line ${lineno}`;
    throw err;
  }
  let context, lines, start, end;
  try {
    str = str || require('fs').readFileSync(filename, {encoding: 'utf8'});
    context = 3;
    lines = str.split('\n');
    start = Math.max(lineno - context, 0);
    end = Math.min(lines.length, lineno + context);
  } catch (ex) {
    err.message +=
      ` - could not read from ${filename} (${ex.message})`;
    pug_rethrow(err, null, lineno);
    return;
  }

  // Error context
  context = lines
    .slice(start, end)
    .map((line, i) => {
      const curr = i + start + 1;
      return `${(curr == lineno ? '  > ' : '    ') + curr}| ${line}`;
    })
    .join('\n');

  // Alter exception message
  err.path = filename;
  try {
    err.message =
      `${filename || 'Pug'}:${lineno}\n${context}\n\n${err.message}`;
  } catch (e) {}
  throw err;
}
