export interface QuizOption {
  id: string
  text: string
  isCorrect: boolean
}

export interface QuizData {
  question: string
  options: QuizOption[]
  explanationCorrect: string
  explanationIncorrect: string
}

export const PHYSICS_QUIZZES: Record<string, QuizData> = {
  law_buoyancy_archimedes: {
    question:
      '密度 $\\rho_1$、体積 $V_1$ の物体を、水（密度 $\\rho$）に浮かべると体積 $V_2$ 部分が水につかった。物体に働く浮力 $F$ の大きさは？（重力加速度を $g$ とする）',
    options: [
      { id: 'opt1', text: '$F = \\rho_1 V_1 g$', isCorrect: false },
      { id: 'opt2', text: '$F = \\rho V_1 g$', isCorrect: false },
      { id: 'opt3', text: '$F = \\rho_1 V_2 g$', isCorrect: false },
      { id: 'opt4', text: '$F = \\rho V_2 g$', isCorrect: true },
    ],
    explanationCorrect: '正解：浮力は「押しのけた水（流体）の質量 $\\rho V_2$ に働く重力」です。',
    explanationIncorrect:
      '不正解：浮力で使う密度は「物体じたいの密度 $\\rho_1$」ではなく「液体の密度 $\\rho$」で、体積は「液体中にある部分 $V_2$」です。',
  },
  // クイズがない定理は何も記述しなくてOKです
}