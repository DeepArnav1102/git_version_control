import React from 'react';

/**
 * ShortcutBadge — sleek minimal hover tooltip
 *
 * Usage:
 *   <ShortcutBadge keys={['G', 'D']}>
 *     <button>Dashboard</button>
 *   </ShortcutBadge>
 *
 *   <ShortcutBadge keys={['/']} position="bottom">
 *     <input ... />
 *   </ShortcutBadge>
 */
export default function ShortcutBadge({ keys = [], position = 'bottom', children }) {
  const posClasses = {
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    top:    'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    left:   'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right:  'left-full top-1/2 -translate-y-1/2 ml-1.5',
  }[position] || 'top-full left-1/2 -translate-x-1/2 mt-1.5';

  return (
    <div className="relative group inline-flex">
      {children}

      {/* Tooltip */}
      <div className={`
        pointer-events-none absolute ${posClasses} z-[9999]
        opacity-0 group-hover:opacity-100
        scale-95 group-hover:scale-100
        transition-all duration-100 ease-out
        flex items-center gap-0.5
      `}>
        {keys.map((k, i) => (
          <React.Fragment key={i}>
            <kbd className="
              inline-flex items-center justify-center
              px-1 py-px
              rounded
              bg-gray-800/90 text-white/90
              text-[9px] font-mono font-medium
              border border-white/10
              shadow-sm
              leading-none
              min-w-[14px] h-[14px]
            ">
              {k}
            </kbd>
            {i < keys.length - 1 && (
              <span className="text-[8px] text-gray-400 mx-px">›</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
