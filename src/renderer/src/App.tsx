import React from 'react';
import { StyleGuide } from './routes/StyleGuide';

export const App: React.FC = () => {
  return (
    <div className="w-screen h-screen overflow-hidden bg-background">
      <StyleGuide />
    </div>
  );
};
