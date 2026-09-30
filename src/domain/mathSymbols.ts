export type SymbolStyle = 'greek' | 'operator' | 'relation' | 'arrow' | 'delimiter' | 'calculus' | 'accent';

export type MathSymbol = {
  id: string;
  label: string;
  latex: string;
  insert: string;
  category: string;
  style: SymbolStyle;
};

export type MathTemplate = {
  id: string;
  label: string;
  description: string;
  insert: string;
  preview: string;
  caretOffset: number;
  style: 'fraction' | 'calculus' | 'matrix' | 'script' | 'delimiter';
};

type SymbolEntry = [string, string, string, string, SymbolStyle];

const entries: SymbolEntry[] = [
  ['greek-alpha', 'α', '\\alpha', '\\alpha ', 'greek'], ['greek-beta', 'β', '\\beta', '\\beta ', 'greek'], ['greek-gamma', 'γ', '\\gamma', '\\gamma ', 'greek'], ['greek-delta', 'δ', '\\delta', '\\delta ', 'greek'], ['greek-theta', 'θ', '\\theta', '\\theta ', 'greek'], ['greek-lambda', 'λ', '\\lambda', '\\lambda ', 'greek'], ['greek-mu', 'μ', '\\mu', '\\mu ', 'greek'], ['greek-pi', 'π', '\\pi', '\\pi ', 'greek'], ['greek-sigma', 'σ', '\\sigma', '\\sigma ', 'greek'], ['greek-phi', 'φ', '\\phi', '\\phi ', 'greek'], ['greek-omega', 'ω', '\\omega', '\\omega ', 'greek'], ['greek-Gamma', 'Γ', '\\Gamma', '\\Gamma ', 'greek'],
  ['operator-plusminus', '±', '\\pm', '\\pm ', 'operator'], ['operator-times', '×', '\\times', '\\times ', 'operator'], ['operator-divide', '÷', '\\div', '\\div ', 'operator'], ['operator-cdot', '·', '\\cdot', '\\cdot ', 'operator'], ['operator-sum', '∑', '\\sum', '\\sum_{i=1}^{n} ', 'operator'], ['operator-product', '∏', '\\prod', '\\prod_{i=1}^{n} ', 'operator'], ['operator-integral', '∫', '\\int', '\\int_a^b ', 'operator'], ['operator-infinity', '∞', '\\infty', '\\infty ', 'operator'],
  ['relation-eq', '=', '=', '= ', 'relation'], ['relation-neq', '≠', '\\neq', '\\neq ', 'relation'], ['relation-leq', '≤', '\\leq', '\\leq ', 'relation'], ['relation-geq', '≥', '\\geq', '\\geq ', 'relation'], ['relation-approx', '≈', '\\approx', '\\approx ', 'relation'], ['relation-equiv', '≡', '\\equiv', '\\equiv ', 'relation'], ['relation-propto', '∝', '\\propto', '\\propto ', 'relation'],
  ['arrow-left', '←', '\\leftarrow', '\\leftarrow ', 'arrow'], ['arrow-right', '→', '\\rightarrow', '\\rightarrow ', 'arrow'], ['arrow-double', '⇔', '\\Leftrightarrow', '\\Leftrightarrow ', 'arrow'], ['arrow-mapsto', '↦', '\\mapsto', '\\mapsto ', 'arrow'], ['arrow-up', '↑', '\\uparrow', '\\uparrow ', 'arrow'], ['arrow-down', '↓', '\\downarrow', '\\downarrow ', 'arrow'],
  ['delimiter-parentheses', '( )', '\\left( \\right)', '\\left(  \\right) ', 'delimiter'], ['delimiter-brackets', '[ ]', '\\left[ \\right]', '\\left[  \\right] ', 'delimiter'], ['delimiter-braces', '{ }', '\\left\\{ \\right\\}', '\\left\\{  \\right\\} ', 'delimiter'], ['delimiter-absolute', '| |', '\\lvert \\rvert', '\\lvert  \\rvert ', 'delimiter'],
  ['calculus-partial', '∂', '\\partial', '\\partial ', 'calculus'], ['calculus-nabla', '∇', '\\nabla', '\\nabla ', 'calculus'], ['calculus-lim', 'lim', '\\lim', '\\lim_{x\\to 0} ', 'calculus'], ['calculus-diff', 'd/dx', '\\frac{d}{dx}', '\\frac{d}{dx} ', 'calculus'],
  ['accent-bar', 'x̄', '\\bar{x}', '\\bar{x}', 'accent'], ['accent-hat', 'x̂', '\\hat{x}', '\\hat{x}', 'accent'], ['accent-vector', 'v⃗', '\\vec{v}', '\\vec{v}', 'accent'], ['accent-tilde', 'x̃', '\\tilde{x}', '\\tilde{x}', 'accent'],
  ['greek-epsilon', 'ε', '\\epsilon', '\\epsilon ', 'greek'], ['greek-eta', 'η', '\\eta', '\\eta ', 'greek'], ['greek-kappa', 'κ', '\\kappa', '\\kappa ', 'greek'], ['greek-rho', 'ρ', '\\rho', '\\rho ', 'greek'], ['greek-tau', 'τ', '\\tau', '\\tau ', 'greek'], ['greek-upsilon', 'υ', '\\upsilon', '\\upsilon ', 'greek'], ['greek-xi', 'ξ', '\\xi', '\\xi ', 'greek'], ['greek-zeta', 'ζ', '\\zeta', '\\zeta ', 'greek'], ['greek-Delta', 'Δ', '\\Delta', '\\Delta ', 'greek'], ['greek-Lambda', 'Λ', '\\Lambda', '\\Lambda ', 'greek'], ['greek-Sigma', 'Σ', '\\Sigma', '\\Sigma ', 'greek'], ['greek-Omega', 'Ω', '\\Omega', '\\Omega ', 'greek'],
  ['operator-nary-union', '⋃', '\\bigcup', '\\bigcup ', 'operator'], ['operator-nary-intersection', '⋂', '\\bigcap', '\\bigcap ', 'operator'], ['operator-oint', '∮', '\\oint', '\\oint ', 'operator'], ['operator-square', '□', '\\square', '\\square ', 'operator'], ['operator-triangle', '△', '\\triangle', '\\triangle ', 'operator'], ['operator-star', '⋆', '\\star', '\\star ', 'operator'],
  ['relation-sim', '∼', '\\sim', '\\sim ', 'relation'], ['relation-cong', '≅', '\\cong', '\\cong ', 'relation'], ['relation-subset', '⊂', '\\subset', '\\subset ', 'relation'], ['relation-supset', '⊃', '\\supset', '\\supset ', 'relation'], ['relation-in', '∈', '\\in', '\\in ', 'relation'], ['relation-notin', '∉', '\\notin', '\\notin ', 'relation'], ['relation-forall', '∀', '\\forall', '\\forall ', 'relation'], ['relation-exists', '∃', '\\exists', '\\exists ', 'relation'],
  ['arrow-long-right', '⟶', '\\longrightarrow', '\\longrightarrow ', 'arrow'], ['arrow-long-left', '⟵', '\\longleftarrow', '\\longleftarrow ', 'arrow'], ['arrow-hook-right', '↪', '\\hookrightarrow', '\\hookrightarrow ', 'arrow'], ['arrow-iff', '⟺', '\\Longleftrightarrow', '\\Longleftrightarrow ', 'arrow'],
  ['delimiter-floor', '⌊x⌋', '\\lfloor x \\rfloor', '\\lfloor x \\rfloor ', 'delimiter'], ['delimiter-ceil', '⌈x⌉', '\\lceil x \\rceil', '\\lceil x \\rceil ', 'delimiter'], ['delimiter-angle', '⟨x⟩', '\\langle x \\rangle', '\\langle x \\rangle ', 'delimiter'],
  ['calculus-contour', '∮', '\\oint', '\\oint_C ', 'calculus'], ['calculus-double-integral', '∬', '\\iint', '\\iint_D ', 'calculus'], ['calculus-triple-integral', '∭', '\\iiint', '\\iiint_V ', 'calculus'], ['calculus-log', 'log', '\\log', '\\log ', 'calculus'], ['calculus-exp', 'exp', '\\exp', '\\exp ', 'calculus'],
  ['accent-overline', 'x̅', '\\overline{x}', '\\overline{x}', 'accent'], ['accent-underline', 'x̲', '\\underline{x}', '\\underline{x}', 'accent'], ['accent-overbrace', '⏞', '\\overbrace{x}', '\\overbrace{x}', 'accent'], ['accent-underbrace', '⏟', '\\underbrace{x}', '\\underbrace{x}', 'accent']
];

export const SYMBOL_CATEGORIES = ['希腊字母', '运算符', '关系符', '箭头', '括号', '微积分', '装饰符号'];
const categoryForStyle: Record<SymbolStyle, string> = { greek: '希腊字母', operator: '运算符', relation: '关系符', arrow: '箭头', delimiter: '括号', calculus: '微积分', accent: '装饰符号' };

export const MATH_SYMBOLS: MathSymbol[] = entries.map(([id, label, latex, insert, style]) => ({ id, label, latex, insert, style, category: categoryForStyle[style] }));

export const MATH_TEMPLATES: MathTemplate[] = [
  { id: 'template-fraction', label: '分式', description: '分子 / 分母', insert: '\\frac{}{}', preview: '\\frac{a}{b}', caretOffset: 6, style: 'fraction' },
  { id: 'template-binomial', label: '二项式', description: '组合数', insert: '\\binom{}{}', preview: '\\binom{n}{k}', caretOffset: 7, style: 'fraction' },
  { id: 'template-sqrt', label: '根式', description: '平方根', insert: '\\sqrt{}', preview: '\\sqrt{x}', caretOffset: 6, style: 'fraction' },
  { id: 'template-root', label: 'n 次根', description: '带根指数', insert: '\\sqrt[]{}', preview: '\\sqrt[n]{x}', caretOffset: 6, style: 'fraction' },
  { id: 'template-superscript', label: '上标', description: 'x 的 n 次方', insert: '^{}', preview: 'x^{n}', caretOffset: 2, style: 'script' },
  { id: 'template-subscript', label: '下标', description: '变量下标', insert: '_{}', preview: 'x_{i}', caretOffset: 2, style: 'script' },
  { id: 'template-integral-limits', label: '定积分', description: '积分上下限', insert: '\\int_{a}^{b} f(x)\\,dx', preview: '\\int_{a}^{b} f(x)\\,dx', caretOffset: 7, style: 'calculus' },
  { id: 'template-limit', label: '极限', description: '变量趋近', insert: '\\lim_{x \\to a} f(x)', preview: '\\lim_{x \\to a} f(x)', caretOffset: 7, style: 'calculus' },
  { id: 'template-sum-limits', label: '求和', description: '求和上下限', insert: '\\sum_{i=1}^{n} a_i', preview: '\\sum_{i=1}^{n} a_i', caretOffset: 6, style: 'calculus' },
  { id: 'template-product-limits', label: '连乘', description: '连乘上下限', insert: '\\prod_{i=1}^{n} a_i', preview: '\\prod_{i=1}^{n} a_i', caretOffset: 7, style: 'calculus' },
  { id: 'template-derivative', label: '导数', description: '一阶导数', insert: '\\frac{d f}{d x}', preview: '\\frac{d f}{d x}', caretOffset: 6, style: 'calculus' },
  { id: 'template-partial', label: '偏导', description: '偏导数', insert: '\\frac{\\partial f}{\\partial x}', preview: '\\frac{\\partial f}{\\partial x}', caretOffset: 6, style: 'calculus' },
  { id: 'template-matrix', label: '矩阵', description: '2 × 2 矩阵', insert: '\\begin{bmatrix} & \\\\ & \\end{bmatrix}', preview: '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}', caretOffset: 17, style: 'matrix' },
  { id: 'template-cases', label: '分段函数', description: '条件分支', insert: '\\begin{cases} & \\\\ & \\end{cases}', preview: 'f(x)=\\begin{cases}x & x\\ge 0 \\\\-x & x<0\\end{cases}', caretOffset: 15, style: 'matrix' },
  { id: 'template-norm', label: '范数', description: '向量范数', insert: '\\lVert \\rVert', preview: '\\lVert v \\rVert', caretOffset: 7, style: 'delimiter' },
  { id: 'template-inner-product', label: '内积', description: '向量内积', insert: '\\langle \\rangle', preview: '\\langle u,v \\rangle', caretOffset: 9, style: 'delimiter' },
  { id: 'template-double-integral', label: '二重积分', description: '区域积分', insert: '\\iint_D f(x,y)\\,dA', preview: '\\iint_D f(x,y)\\,dA', caretOffset: 6, style: 'calculus' },
  { id: 'template-contour-integral', label: '曲线积分', description: '闭合路径积分', insert: '\\oint_C \\vec F\\cdot d\\vec r', preview: '\\oint_C \\vec F\\cdot d\\vec r', caretOffset: 7, style: 'calculus' },
  { id: 'template-series', label: '级数', description: '无穷级数', insert: '\\sum_{n=0}^{\\infty} a_n', preview: '\\sum_{n=0}^{\\infty} a_n', caretOffset: 6, style: 'calculus' },
  { id: 'template-taylor', label: '泰勒级数', description: '函数展开', insert: '\\sum_{n=0}^{\\infty}\\frac{f^{(n)}(a)}{n!}(x-a)^n', preview: '\\sum_{n=0}^{\\infty}\\frac{f^{(n)}(a)}{n!}(x-a)^n', caretOffset: 6, style: 'calculus' },
  { id: 'template-expectation', label: '期望', description: '随机变量期望', insert: '\\mathbb{E}[X]=\\sum_x xp(x)', preview: '\\mathbb{E}[X]=\\sum_x xp(x)', caretOffset: 11, style: 'calculus' },
  { id: 'template-variance', label: '方差', description: '随机变量方差', insert: '\\operatorname{Var}(X)=\\mathbb{E}[(X-\\mu)^2]', preview: '\\operatorname{Var}(X)=\\mathbb{E}[(X-\\mu)^2]', caretOffset: 21, style: 'calculus' },
  { id: 'template-gradient', label: '梯度', description: '多元函数梯度', insert: '\\nabla f', preview: '\\nabla f=(\\partial_x f,\\partial_y f)', caretOffset: 7, style: 'calculus' },
  { id: 'template-divergence', label: '散度', description: '向量场散度', insert: '\\nabla\\cdot\\vec F', preview: '\\nabla\\cdot\\vec F', caretOffset: 17, style: 'calculus' },
  { id: 'template-determinant', label: '行列式', description: '三阶行列式', insert: '\\begin{vmatrix} & & \\\\ & & \\\\ & & \\end{vmatrix}', preview: '\\begin{vmatrix}a&b&c\\\\d&e&f\\\\g&h&i\\end{vmatrix}', caretOffset: 16, style: 'matrix' },
  { id: 'template-aligned', label: '对齐方程', description: '多行等式对齐', insert: '\\begin{aligned} &= \\\\ &= \\end{aligned}', preview: '\\begin{aligned}a&=b+c\\\\d&=e+f\\end{aligned}', caretOffset: 17, style: 'matrix' },
  { id: 'template-set-builder', label: '集合构造', description: '集合条件描述', insert: '\\{x\\in A\\mid P(x)\\}', preview: '\\{x\\in A\\mid P(x)\\}', caretOffset: 2, style: 'delimiter' },
  { id: 'template-floor', label: '取整', description: '向下取整', insert: '\\lfloor x \\rfloor', preview: '\\lfloor x \\rfloor', caretOffset: 8, style: 'delimiter' },
  { id: 'template-overline', label: '上划线', description: '平均值/共轭', insert: '\\overline{}', preview: '\\overline{x}', caretOffset: 10, style: 'script' }
];
