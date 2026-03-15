import React from 'react';
import './Chip.css';

/**
 * Atomic Chip component — compact info / status / selection pill.
 *
 * Variants: default | active | muted | success | error
 * Sizes:    sm | md (default)
 *
 * Props:
 *  - variant   {'default'|'active'|'muted'|'success'|'error'}
 *  - size      {'sm'|'md'}
 *  - icon      {ReactNode}  – leading icon
 *  - iconEnd   {ReactNode}  – trailing icon / action
 *  - onClick   {function}   – if set, renders as a button
 *  - selected  {boolean}    – toggles active styling
 *  - className {string}
 *  - children  {ReactNode}
 */
function Chip({
  variant = 'default',
  size = 'md',
  icon,
  iconEnd,
  onClick,
  selected = false,
  className = '',
  children,
  ...rest
}) {
  const Tag = onClick ? 'button' : 'span';
  const classes = [
    'chip',
    `chip--${variant}`,
    `chip--${size}`,
    selected && 'chip--selected',
    onClick && 'chip--interactive',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag
      className={classes}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      role={onClick ? undefined : 'status'}
      {...rest}
    >
      {icon && <span className="chip__icon" aria-hidden="true">{icon}</span>}
      <span className="chip__label">{children}</span>
      {iconEnd && <span className="chip__icon chip__icon--end" aria-hidden="true">{iconEnd}</span>}
    </Tag>
  );
}

export default Chip;
