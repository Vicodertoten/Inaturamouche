import React, { forwardRef } from 'react';
import './Button.css';

/**
 * Atomic Button component — single source of truth for all buttons.
 *
 * Variants: primary | secondary | outline | ghost | accent
 * Sizes:    sm | md (default) | lg
 *
 * Props:
 *  - variant    {'primary'|'secondary'|'outline'|'ghost'|'accent'}
 *  - size       {'sm'|'md'|'lg'}
 *  - loading    {boolean}  – shows spinner, disables clicks
 *  - icon       {ReactNode} – leading icon element
 *  - iconEnd    {ReactNode} – trailing icon element
 *  - fullWidth  {boolean}  – stretches to container width
 *  - className  {string}   – extra classes
 *  - children   {ReactNode}
 *  - ...rest    – native button attributes (onClick, disabled, type, etc.)
 */
const Button = forwardRef(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    icon,
    iconEnd,
    fullWidth = false,
    className = '',
    children,
    disabled,
    ...rest
  },
  ref,
) {
  const classes = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    loading && 'btn--loading',
    fullWidth && 'btn--full',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      className={classes}
      disabled={disabled || loading}
      {...rest}
    >
      {icon && <span className="btn__icon btn__icon--start" aria-hidden="true">{icon}</span>}
      {children && <span className="btn__label">{children}</span>}
      {iconEnd && <span className="btn__icon btn__icon--end" aria-hidden="true">{iconEnd}</span>}
    </button>
  );
});

export default Button;
