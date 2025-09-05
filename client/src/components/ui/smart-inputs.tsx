import React from 'react';
import { useSmartReplace } from '@/hooks/use-smart-replace';

export const SmartInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => {
    const smartReplace = useSmartReplace();
    return (
      <input
        {...props}
        ref={ref}
        onChange={e => {
          if (props.onChange) props.onChange(e);
          if (e.target.value !== smartReplace(e.target.value)) {
            e.target.value = smartReplace(e.target.value);
            // For controlled components, fire synthetic event
            if (props.onChange) props.onChange(e);
          }
        }}
      />
    );
  }
);
SmartInput.displayName = 'SmartInput';

export const SmartTextarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  (props, ref) => {
    const smartReplace = useSmartReplace();
    return (
      <textarea
        {...props}
        ref={ref}
        onChange={e => {
          if (props.onChange) props.onChange(e);
          if (e.target.value !== smartReplace(e.target.value)) {
            e.target.value = smartReplace(e.target.value);
            if (props.onChange) props.onChange(e);
          }
        }}
      />
    );
  }
);
SmartTextarea.displayName = 'SmartTextarea';
