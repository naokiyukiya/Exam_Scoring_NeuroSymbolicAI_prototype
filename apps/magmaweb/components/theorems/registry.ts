import dynamic from 'next/dynamic';
import React from 'react';

export const theoremComponentMap: Record<string, React.ComponentType<any>> = {
  law_buoyancy_archimedes: dynamic(() => import('./content/law_buoyancy_archimedes')),
  law_fluid_pressure: dynamic(() => import('./content/law_fluid_pressure')), 
};