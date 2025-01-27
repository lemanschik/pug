export var __esModule = true;
// "@babel/parser": "^7.6",
// "@babel/types": "^7.6"
import parser_1 from "@babel/parser";
import b from "@babel/types";
export function binaryOperation(operator, left, right) {
    switch (operator) {
        case '+':
            return left + right;
        case '-':
            return left - right;
        case '/':
            return left / right;
        case '%':
            return left % right;
        case '*':
            return left * right;
        case '**':
            return Math.pow(left, right);
        case '&':
            return left & right;
        case '|':
            return left | right;
        case '>>':
            return left >> right;
        case '>>>':
            return left >>> right;
        case '<<':
            return left << right;
        case '^':
            return left ^ right;
        case '==':
            return left == right;
        case '===':
            return left === right;
        case '!=':
            return left != right;
        case '!==':
            return left !== right;
        case 'in':
            return left in right;
        case 'instanceof':
            return left instanceof right;
        case '>':
            return left > right;
        case '<':
            return left < right;
        case '>=':
            return left >= right;
        case '<=':
            return left <= right;
    }
}

function expressionToConstant(expression, options) {
    if (options === void 0) { options = {}; }
    let constant = true;
    function toConstant(expression) {
        if (!constant)
            return;
        if (b.isArrayExpression(expression)) {
            const result_1 = [];
            for (var i = 0; constant && i < expression.elements.length; i++) {
                const element = expression.elements[i];
                if (b.isSpreadElement(element)) {
                    var spread = toConstant(element.argument);
                    if (!(isSpreadable(spread) && constant)) {
                        constant = false;
                    }
                    else {
                        result_1.push(...spread);
                    }
                }
                else if (b.isExpression(element)) {
                    result_1.push(toConstant(element));
                }
                else {
                    constant = false;
                }
            }
            return result_1;
        }
        if (b.isBinaryExpression(expression)) {
            var left = toConstant(expression.left);
            var right = toConstant(expression.right);
            return constant && binaryOperation["default"](expression.operator, left, right);
        }
        if (b.isBooleanLiteral(expression)) {
            return expression.value;
        }
        if (b.isCallExpression(expression)) {
            const args = [];
            for (var i = 0; constant && i < expression.arguments.length; i++) {
                const arg = expression.arguments[i];
                if (b.isSpreadElement(arg)) {
                    var spread = toConstant(arg.argument);
                    if (!(isSpreadable(spread) && constant)) {
                        constant = false;
                    }
                    else {
                        args.push(...spread);
                    }
                }
                else if (b.isExpression(arg)) {
                    args.push(toConstant(arg));
                }
                else {
                    constant = false;
                }
            }
            if (!constant)
                return;
            if (b.isMemberExpression(expression.callee)) {
                var object = toConstant(expression.callee.object);
                if (!object || !constant) {
                    constant = false;
                    return;
                }
                var member = expression.callee.computed
                    ? toConstant(expression.callee.property)
                    : b.isIdentifier(expression.callee.property)
                        ? expression.callee.property.name
                        : undefined;
                if (member === undefined && !expression.callee.computed) {
                    constant = false;
                }
                if (!constant)
                    return;
                if (canCallMethod(object, `${member}`)) {
                    return object[member](...args);
                }
            }
            else {
                if (!b.isExpression(expression.callee)) {
                    constant = false;
                    return;
                }
                const callee = toConstant(expression.callee);
                if (!constant)
                    return;
                return callee(...args);
            }
        }
        if (b.isConditionalExpression(expression)) {
            const test = toConstant(expression.test);
            return test
                ? toConstant(expression.consequent)
                : toConstant(expression.alternate);
        }
        if (b.isIdentifier(expression)) {
            if (options.constants &&
                {}.hasOwnProperty.call(options.constants, expression.name)) {
                return options.constants[expression.name];
            }
        }
        if (b.isLogicalExpression(expression)) {
            var left = toConstant(expression.left);
            var right = toConstant(expression.right);
            if (constant && expression.operator === '&&') {
                return left && right;
            }
            if (constant && expression.operator === '||') {
                return left || right;
            }
        }
        if (b.isMemberExpression(expression)) {
            var object = toConstant(expression.object);
            if (!object || !constant) {
                constant = false;
                return;
            }
            var member = expression.computed
                ? toConstant(expression.property)
                : b.isIdentifier(expression.property)
                    ? expression.property.name
                    : undefined;
            if (member === undefined && !expression.computed) {
                constant = false;
            }
            if (!constant)
                return;
            if ({}.hasOwnProperty.call(object, `${member}`) && member[0] !== '_') {
                return object[member];
            }
        }
        if (b.isNullLiteral(expression)) {
            return null;
        }
        if (b.isNumericLiteral(expression)) {
            return expression.value;
        }
        if (b.isObjectExpression(expression)) {
            const result_2 = {};
            for (var i = 0; constant && i < expression.properties.length; i++) {
                const property = expression.properties[i];
                if (b.isObjectProperty(property)) {
                    if (property.shorthand) {
                        constant = false;
                        return;
                    }
                    const key = property.computed
                        ? toConstant(property.key)
                        : b.isIdentifier(property.key)
                            ? property.key.name
                            : b.isStringLiteral(property.key)
                                ? property.key.value
                                : undefined;
                    if (!key || key[0] === '_') {
                        constant = false;
                    }
                    if (!constant)
                        return;
                    if (b.isExpression(property.value)) {
                        const value = toConstant(property.value);
                        if (!constant)
                            return;
                        result_2[key] = value;
                    }
                    else {
                        constant = false;
                    }
                }
                else if (b.isObjectMethod(property)) {
                    constant = false;
                }
                else if (b.isSpreadProperty(property)) {
                    var argument = toConstant(property.argument);
                    if (!argument)
                        constant = false;
                    if (!constant)
                        return;
                    Object.assign(result_2, argument);
                }
            }
            return result_2;
        }
        if (b.isParenthesizedExpression(expression)) {
            return toConstant(expression.expression);
        }
        if (b.isRegExpLiteral(expression)) {
            return new RegExp(expression.pattern, expression.flags);
        }
        if (b.isSequenceExpression(expression)) {
            for (var i = 0; i < expression.expressions.length - 1 && constant; i++) {
                toConstant(expression.expressions[i]);
            }
            return toConstant(expression.expressions[expression.expressions.length - 1]);
        }
        if (b.isStringLiteral(expression)) {
            return expression.value;
        }
        // TODO: TaggedTemplateExpression
        if (b.isTemplateLiteral(expression)) {
            let result_3 = '';
            for (var i = 0; i < expression.quasis.length; i++) {
                const quasi = expression.quasis[i];
                result_3 += quasi.value.cooked;
                if (i < expression.expressions.length) {
                    result_3 += `${toConstant(expression.expressions[i])}`;
                }
            }
            return result_3;
        }
        if (b.isUnaryExpression(expression)) {
            var argument = toConstant(expression.argument);
            if (!constant) {
                return;
            }
            switch (expression.operator) {
                case '-':
                    return -argument;
                case '+':
                    return +argument;
                case '!':
                    return !argument;
                case '~':
                    return ~argument;
                case 'typeof':
                    return typeof argument;
                case 'void':
                    return void argument;
            }
        }
        constant = false;
    }
    const result = toConstant(expression);
    return constant ? { constant: true, result } : { constant: false };
}
export {expressionToConstant};
function isSpreadable(value) {
    return (typeof value === 'string' ||
        Array.isArray(value) ||
        (typeof Set !== 'undefined' && value instanceof Set) ||
        (typeof Map !== 'undefined' && value instanceof Map));
}
function shallowEqual(a, b) {
    if (a === b)
        return true;
    if (a && b && typeof a === 'object' && typeof b === 'object') {
        for (var key in a) {
            if (a[key] !== b[key]) {
                return false;
            }
        }
        for (var key in b) {
            if (a[key] !== b[key]) {
                return false;
            }
        }
        return true;
    }
    return false;
}
function canCallMethod(object, member) {
    switch (typeof object) {
        case 'boolean':
            switch (member) {
                case 'toString':
                    return true;
                default:
                    return false;
            }
        case 'number':
            switch (member) {
                case 'toExponential':
                case 'toFixed':
                case 'toPrecision':
                case 'toString':
                    return true;
                default:
                    return false;
            }
        case 'string':
            switch (member) {
                case 'charAt':
                case 'charCodeAt':
                case 'codePointAt':
                case 'concat':
                case 'endsWith':
                case 'includes':
                case 'indexOf':
                case 'lastIndexOf':
                case 'match':
                case 'normalize':
                case 'padEnd':
                case 'padStart':
                case 'repeat':
                case 'replace':
                case 'search':
                case 'slice':
                case 'split':
                case 'startsWith':
                case 'substr':
                case 'substring':
                case 'toLowerCase':
                case 'toUpperCase':
                case 'trim':
                    return true;
                default:
                    return false;
            }
        default:
            if (object instanceof RegExp) {
                switch (member) {
                    case 'test':
                    case 'exec':
                        return true;
                    default:
                        return false;
                }
            }
            return {}.hasOwnProperty.call(object, member) && member[0] !== '_';
    }
}
const EMPTY_OBJECT = {};
let lastSrc = '';
let lastConstants = EMPTY_OBJECT;
const lastOptions = EMPTY_OBJECT;
let lastResult = null;
let lastWasConstant = false;
function isConstant(src, constants, options) {
    if (constants === void 0) { constants = EMPTY_OBJECT; }
    if (options === void 0) { options = EMPTY_OBJECT; }
    if (lastSrc === src &&
        shallowEqual(lastConstants, constants) &&
        shallowEqual(lastOptions, options)) {
        return lastWasConstant;
    }
    lastSrc = src;
    lastConstants = constants;
    let ast;
    try {
        ast = parser_1.parseExpression(src, options);
    }
    catch (ex) {
        return (lastWasConstant = false);
    }
    const _a = expressionToConstant(ast, { constants }), result = _a.result, constant = _a.constant;
    lastResult = result;
    return (lastWasConstant = constant);
}
export {isConstant};
function toConstant(src, constants, options) {
    if (constants === void 0) { constants = EMPTY_OBJECT; }
    if (options === void 0) { options = EMPTY_OBJECT; }
    if (!isConstant(src, constants, options)) {
        throw new Error(`${JSON.stringify(src)} is not constant.`);
    }
    return lastResult;
}
export {toConstant};
//exports["default"] = isConstant;
export default isConstant;
// module.exports["default"] = isConstant;
export {expressionToConstant};
export {isConstant};

export {toConstant};