import { toast } from 'sonner';
import { useEffect, useRef } from 'react';
import { animate } from 'animejs';

const BouncyToast = ({ t, message, type = 'success' }) => {
  const toastRef = useRef(null);

  useEffect(() => {
    // Bouncy entrance animation
    if (toastRef.current) {
      animate(toastRef.current, {
        scale: [0.8, 1.05, 1],
        opacity: [0, 1],
        translateY: [10, -5, 0],
        duration: 600,
        easing: 'easeOutElastic(1, .6)',
      });
    }
  }, []);

  // Solid background colors (no glass design)
  const bgColor = type === 'error' ? 'bg-[#FF453A]' : 'bg-[#32D74B]';
  
  return (
    <div 
      ref={toastRef}
      className={`flex items-center gap-3 w-auto mx-auto px-4 py-2.5 rounded-full shadow-lg ${bgColor} text-white font-sans`}
    >
      <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-white/25 shadow-sm">
        {type === 'error' ? (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <div className="text-[13px] font-medium pr-1">
        {message}
      </div>
    </div>
  );
};

export const jsonToast = {
  success: (message) => {
    toast.custom((t) => <BouncyToast t={t} message={message} type="success" />);
  },
  error: (message) => {
    toast.custom((t) => <BouncyToast t={t} message={message} type="error" />);
  },
  confirm: (message, onConfirm, actionText = 'Confirm') => {
    toast.custom((t) => (
      <div className="flex flex-col gap-3 p-4 bg-white rounded-xl shadow-xl border border-gray-200 min-w-[280px]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="text-sm font-semibold text-gray-800">{message}</div>
        </div>
        <div className="flex justify-end gap-2 mt-1">
          <button 
            onClick={() => toast.dismiss(t)} 
            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              toast.dismiss(t);
              onConfirm();
            }} 
            className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
            data-toast-confirm="true"
          >
            {actionText}
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  }
};
