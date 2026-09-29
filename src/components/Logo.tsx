import React from 'react';

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ size = 24, className = '', ...props }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      {/* Outer Hexagonal Shield / Monolith Arc */}
      <path
        d="M 50 6 L 88 28 L 88 72 L 50 94 L 12 72 L 12 28 Z"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
        fill="none"
        opacity="0.9"
      />
      {/* Inner Geometric Winter Arc "W" & Monolith Apex */}
      <path
        d="M 26 36 L 42 70 L 50 50 L 58 70 L 74 36"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Top Diamond Star / Frost Apex */}
      <path
        d="M 50 20 L 54 28 L 50 36 L 46 28 Z"
        fill="currentColor"
      />
      {/* Subtle Arc Base Bar */}
      <path
        d="M 38 78 L 62 78"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.8"
      />
    </svg>
  );
};
