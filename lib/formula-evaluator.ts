import { fromA1Key, toA1Key, formatDateDisplay } from './excel-utils';

class Token {
  type: string;
  value: any;
  constructor(type: string, value: any) {
    this.type = type;
    this.value = value;
  }
}

class Lexer {
  private input: string;
  private pos: number;

  constructor(input: string) {
    this.input = input;
    this.pos = 0;
  }

  private peek(): string | null {
    if (this.pos >= this.input.length) return null;
    return this.input[this.pos];
  }

  private next(): string | null {
    if (this.pos >= this.input.length) return null;
    return this.input[this.pos++];
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.pos < this.input.length) {
      const char = this.peek();
      if (char === null) break;

      if (/\s/.test(char)) {
        this.next();
        continue;
      }

      if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(this.input[this.pos + 1] || ''))) {
        let numStr = '';
        if (char === '.') {
          numStr += this.next();
        }
        while (this.peek() !== null && /[0-9.]/.test(this.peek()!)) {
          numStr += this.next()!;
        }
        tokens.push(new Token('NUMBER', parseFloat(numStr)));
        continue;
      }

      if (char === '"' || char === "'") {
        const quote = this.next()!;
        let str = '';
        while (this.peek() !== null && this.peek() !== quote) {
          str += this.next()!;
        }
        if (this.peek() === quote) {
          this.next(); // consume ending quote
        }
        tokens.push(new Token('STRING', str));
        continue;
      }

      if (/[a-zA-Z_$]/.test(char)) {
        let ident = '';
        while (this.peek() !== null && /[a-zA-Z0-9_$]/.test(this.peek()!)) {
          ident += this.next()!;
        }
        tokens.push(new Token('IDENTIFIER', ident));
        continue;
      }

      if (char === ':') {
        tokens.push(new Token('COLON', this.next()));
      } else if (char === '+') {
        tokens.push(new Token('PLUS', this.next()));
      } else if (char === '-') {
        tokens.push(new Token('MINUS', this.next()));
      } else if (char === '*') {
        tokens.push(new Token('STAR', this.next()));
      } else if (char === '/') {
        tokens.push(new Token('SLASH', this.next()));
      } else if (char === '(') {
        tokens.push(new Token('LPAREN', this.next()));
      } else if (char === ')') {
        tokens.push(new Token('RPAREN', this.next()));
      } else if (char === ',') {
        tokens.push(new Token('COMMA', this.next()));
      } else {
        tokens.push(new Token('UNKNOWN', this.next()));
      }
    }
    return tokens;
  }
}

interface ASTNode {
  type: string;
  value?: any;
  name?: string;
  args?: ASTNode[];
  op?: string;
  left?: ASTNode;
  right?: ASTNode;
  start?: string;
  end?: string;
}

class Parser {
  private tokens: Token[];
  private pos: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  private peek(): Token | null {
    if (this.pos >= this.tokens.length) return null;
    return this.tokens[this.pos];
  }

  private next(): Token | null {
    if (this.pos >= this.tokens.length) return null;
    return this.tokens[this.pos++];
  }

  parse(): ASTNode {
    const expr = this.parseExpression();
    if (this.pos < this.tokens.length) {
      throw new Error('Unexpected extra tokens');
    }
    return expr;
  }

  private parseExpression(precedence = 0): ASTNode {
    let left = this.parsePrimary();

    while (true) {
      const nextToken = this.peek();
      if (!nextToken) break;

      const prec = this.getPrecedence(nextToken);
      if (prec < precedence) break;

      this.next(); // consume the operator

      if (nextToken.type === 'COLON') {
        if (left.type !== 'CELL') {
          throw new Error('Range start must be cell');
        }
        const right = this.parsePrimary();
        if (right.type !== 'CELL') {
          throw new Error('Range end must be cell');
        }
        left = { type: 'RANGE', start: left.value, end: right.value };
      } else {
        const right = this.parseExpression(prec + 1);
        left = {
          type: 'BINARY_OP',
          op: nextToken.value,
          left,
          right
        };
      }
    }

    return left;
  }

  private parsePrimary(): ASTNode {
    const token = this.peek();
    if (!token) throw new Error('Unexpected end of expression');

    if (token.type === 'NUMBER') {
      this.next();
      return { type: 'NUMBER', value: token.value };
    }

    if (token.type === 'STRING') {
      this.next();
      return { type: 'STRING', value: token.value };
    }

    if (token.type === 'IDENTIFIER') {
      this.next();
      const nextToken = this.peek();
      if (nextToken && nextToken.type === 'LPAREN') {
        this.next(); // consume LPAREN
        const args: ASTNode[] = [];
        if (this.peek() && this.peek()!.type !== 'RPAREN') {
          args.push(this.parseExpression());
          while (this.peek() && this.peek()!.type === 'COMMA') {
            this.next(); // consume COMMA
            args.push(this.parseExpression());
          }
        }
        if (!this.peek() || this.peek()!.type !== 'RPAREN') {
          throw new Error('Expected matching RPAREN');
        }
        this.next(); // consume RPAREN
        return { type: 'FUNCTION', name: token.value.toUpperCase(), args };
      }

      const isCell = /^[A-Z]+\d+$/i.test(token.value);
      if (isCell) {
        return { type: 'CELL', value: token.value.toUpperCase() };
      }

      return { type: 'IDENTIFIER', value: token.value };
    }

    if (token.type === 'LPAREN') {
      this.next(); // consume LPAREN
      const expr = this.parseExpression();
      const nextToken = this.next();
      if (!nextToken || nextToken.type !== 'RPAREN') {
        throw new Error("Expected matching RPAREN");
      }
      return expr;
    }

    if (token.type === 'MINUS') {
      this.next();
      const expr = this.parseExpression(100);
      return { type: 'UNARY_OP', op: '-', right: expr };
    }

    if (token.type === 'PLUS') {
      this.next();
      return this.parseExpression(100);
    }

    throw new Error('Unexpected token');
  }

  private getPrecedence(token: Token): number {
    switch (token.type) {
      case 'COLON': return 40;
      case 'STAR':
      case 'SLASH': return 20;
      case 'PLUS':
      case 'MINUS': return 10;
      default: return -1;
    }
  }
}

function evaluateAST(
  node: ASTNode,
  rowData: any,
  gridData: Map<string, any>,
  masterColumnOrder: string[] | Map<string, number>,
  columnOrder: string[],
  formatId: string | undefined,
  evaluatingCells: Set<string>
): any {
  const getColIndex = (colName: string): number => {
    if (masterColumnOrder instanceof Map) {
      return masterColumnOrder.get(colName) ?? -1;
    }
    return masterColumnOrder.indexOf(colName);
  };

  const headers = columnOrder.length > 0 ? columnOrder : ["Title / Item", "Amount", "Location", "Allocation", "Notes"];

  const resolveCellValue = (a1Key: string) => {
    const coords = fromA1Key(a1Key);
    if (!coords) return null;
    const colName = headers[coords.colIndex];
    if (!colName) return null;
    const mIdx = getColIndex(colName);
    if (mIdx === -1) return null;

    const targetKey = toA1Key(coords.row, mIdx);
    
    if (evaluatingCells.has(targetKey)) {
      throw new Error('#REF!');
    }

    const rawVal = gridData.get(targetKey);
    if (typeof rawVal === 'string' && rawVal.startsWith('=')) {
      evaluatingCells.add(targetKey);
      try {
        const parsed = parseFormulaString(rawVal);
        return evaluateAST(
          parsed,
          rowData,
          gridData,
          masterColumnOrder,
          columnOrder,
          formatId,
          evaluatingCells
        );
      } finally {
        evaluatingCells.delete(targetKey);
      }
    }
    return rawVal === undefined ? null : rawVal;
  };

  switch (node.type) {
    case 'NUMBER':
      return node.value;
    case 'STRING':
      return node.value;
    case 'CELL':
      return resolveCellValue(node.value!);
    case 'IDENTIFIER': {
      const actualKey = Object.keys(rowData).find(key => key.toLowerCase() === node.value.toLowerCase());
      if (actualKey) return rowData[actualKey];
      return isNaN(Number(node.value)) ? node.value : Number(node.value);
    }
    case 'UNARY_OP': {
      const rightVal = Number(evaluateAST(node.right!, rowData, gridData, masterColumnOrder, columnOrder, formatId, evaluatingCells));
      if (node.op === '-') return -rightVal;
      return rightVal;
    }
    case 'BINARY_OP': {
      const leftVal = Number(evaluateAST(node.left!, rowData, gridData, masterColumnOrder, columnOrder, formatId, evaluatingCells));
      const rightVal = Number(evaluateAST(node.right!, rowData, gridData, masterColumnOrder, columnOrder, formatId, evaluatingCells));
      if (isNaN(leftVal) || isNaN(rightVal)) return '#VALUE!';
      switch (node.op) {
        case '+': return leftVal + rightVal;
        case '-': return leftVal - rightVal;
        case '*': return leftVal * rightVal;
        case '/': return rightVal === 0 ? '#DIV/0!' : leftVal / rightVal;
        default: throw new Error(`Unknown operator: ${node.op}`);
      }
    }
    case 'RANGE':
      throw new Error('Range nodes must be evaluated within standard range functions like SUM');
    case 'FUNCTION': {
      if (node.name === 'SUM') {
        let total = 0;
        node.args!.forEach(arg => {
          if (arg.type === 'RANGE') {
            const sC = fromA1Key(arg.start!);
            const eC = fromA1Key(arg.end!);
            if (sC && eC) {
              for (let r = Math.min(sC.row, eC.row); r <= Math.max(sC.row, eC.row); r++) {
                for (let c = Math.min(sC.colIndex, eC.colIndex); c <= Math.max(sC.colIndex, eC.colIndex); c++) {
                  const colName = headers[c];
                  if (!colName) continue;
                  const mIdx = getColIndex(colName);
                  if (mIdx !== -1) {
                    const cellKey = toA1Key(r, mIdx);
                    if (evaluatingCells.has(cellKey)) {
                      throw new Error('#REF!');
                    }
                    const rawVal = gridData.get(cellKey);
                    let val = rawVal;
                    if (typeof rawVal === 'string' && rawVal.startsWith('=')) {
                      evaluatingCells.add(cellKey);
                      try {
                        val = evaluateAST(parseFormulaString(rawVal), rowData, gridData, masterColumnOrder, columnOrder, formatId, evaluatingCells);
                      } finally {
                        evaluatingCells.delete(cellKey);
                      }
                    }
                    total += (Number(val) || 0);
                  }
                }
              }
            }
          } else {
            const val = evaluateAST(arg, rowData, gridData, masterColumnOrder, columnOrder, formatId, evaluatingCells);
            total += (Number(val) || 0);
          }
        });
        return total;
      }

      if (node.name === 'ADD_DAYS') {
        if (node.args!.length !== 2) return '#ARGS!';
        let dateVal = evaluateAST(node.args![0], rowData, gridData, masterColumnOrder, columnOrder, formatId, evaluatingCells);
        let daysVal = evaluateAST(node.args![1], rowData, gridData, masterColumnOrder, columnOrder, formatId, evaluatingCells);

        if (!isNaN(Number(dateVal)) && isNaN(Number(daysVal))) {
          [dateVal, daysVal] = [daysVal, dateVal];
        }

        if (dateVal === null || dateVal === undefined || dateVal === '') return '';

        let date = new Date(dateVal);
        if (isNaN(date.getTime()) && typeof dateVal === 'string' && dateVal.includes('-')) {
          const parts = dateVal.split('-');
          if (parts.length === 3) {
            if (parts[0].length === 4) {
              date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            } else if (parts[2].length === 4) {
              date = new Date(Number(parts[2]), Number(parts[0]) - 1, Number(parts[1]));
            }
          }
        }

        const days = Number(daysVal);
        if (isNaN(date.getTime())) return '#DATE!';
        if (isNaN(days)) return '#NUM!';

        const resultDate = new Date(date);
        resultDate.setDate(resultDate.getDate() + days);
        return formatDateDisplay(resultDate, formatId);
      }

      return '#NAME?';
    }
    default:
      throw new Error(`Unknown AST Node Type: ${node.type}`);
  }
}

function parseFormulaString(value: string): ASTNode {
  if (typeof value !== 'string' || !value.startsWith('=')) {
    throw new Error('Not a formula string');
  }
  const formulaContent = value.substring(1);
  const lexer = new Lexer(formulaContent);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

export function evaluateFormula(
  value: any, 
  rowData: any, 
  gridData: Map<string, any>, 
  masterColumnOrder: string[] | Map<string, number>, 
  columnOrder: string[], 
  formatId?: string
): any {
  if (typeof value !== 'string' || !value.startsWith('=')) return value;
  try {
    const parsed = parseFormulaString(value);
    const evaluatingCells = new Set<string>();
    return evaluateAST(
      parsed,
      rowData,
      gridData,
      masterColumnOrder,
      columnOrder,
      formatId,
      evaluatingCells
    );
  } catch (e: any) {
    if (e.message === '#REF!') return '#REF!';
    if (e.message.includes('#DIV/0!')) return '#DIV/0!';
    return '#ERROR!';
  }
}
