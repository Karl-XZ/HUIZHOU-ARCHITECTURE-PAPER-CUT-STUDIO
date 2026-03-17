import HomePage from './pages/HomePage';
import ResultPage from './pages/ResultPage';
import type { ReactNode } from 'react';

interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
}

const routes: RouteConfig[] = [
  {
    name: '首页',
    path: '/',
    element: <HomePage />,
  },
  {
    name: '生成结果',
    path: '/result/:generationId',
    element: <ResultPage />,
  },
];

export default routes;
