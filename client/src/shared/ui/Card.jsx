import React from 'react';
import './Card.css';

/**
 * Atomic Card component — generic surface container.
 *
 * Variants: default | elevated | flat | interactive
 *
 * Props:
 *  - variant   {'default'|'elevated'|'flat'|'interactive'}
 *  - padding   {'none'|'sm'|'md'|'lg'}  – inner spacing
 *  - onClick   {function}  – if set, renders as button-card
 *  - className {string}
 *  - children  {ReactNode}
 *  - as        {string}    – DOM element ('div', 'section', 'article')
 */
function Card({
  variant = 'default',
  padding = 'md',
  onClick,
  className = '',
  children,
  as: Tag = onClick ? 'button' : 'div',
  ...rest
}) {
  const classes = [
    'card-ds',
    `card-ds--${variant}`,
    `card-ds--pad-${padding}`,
    onClick && 'card-ds--clickable',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag
      className={classes}
      onClick={onClick}
      type={onClick && Tag === 'button' ? 'button' : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export default Card;
