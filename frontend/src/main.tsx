import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import '@mantine/core/styles.css';
import App from './App';
import './index.css';

const theme = createTheme({
  colors: {
    patropi: [
      '#eef6fc',
      '#d8ebf7',
      '#b2d7ef',
      '#86c0e6',
      '#499bda',
      '#236baa',
      '#236baa',
      '#1a5284',
      '#133c61',
      '#0b243b',
    ],
    pink: [
      '#fdecf2',
      '#fbd3e2',
      '#f7a6c5',
      '#f376a5',
      '#ee4282',
      '#ec1c66',
      '#ec1c66',
      '#c21453',
      '#990c40',
      '#70052d',
    ],
    teal: [
      '#f1f9f6',
      '#deedd8',
      '#bfded4',
      '#9bd0c0',
      '#79c1a8',
      '#79c1a8',
      '#5aa990',
      '#418772',
      '#2d6353',
      '#1a3d33',
    ],
    dark: [
      '#C1C2C5',
      '#A6A7AB',
      '#909296',
      '#5C5F66',
      '#373A40',
      '#2C2E33',
      '#111111',
      '#333333',
      '#111111',
      '#0a0a0a',
    ],
  },
  primaryColor: 'patropi',
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  defaultRadius: 'md',
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <App />
    </MantineProvider>
  </React.StrictMode>,
);
