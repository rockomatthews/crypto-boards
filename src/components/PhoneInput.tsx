'use client';

import React, { forwardRef, useState, useEffect } from 'react';
import { TextField, Box, TextFieldProps } from '@mui/material';
import PhoneInputComponent from 'react-phone-number-input';
import { isValidPhoneNumber } from 'libphonenumber-js';
import 'react-phone-number-input/style.css';

interface PhoneInputProps {
  value?: string | null;
  onChange?: (value?: string) => void;
  label?: string;
  placeholder?: string;
  helperText?: string;
  error?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
}

// Custom TextField component for better integration
const CustomTextField = forwardRef<HTMLInputElement, TextFieldProps>((props, ref) => {
  return (
    <TextField
      {...props}
      ref={ref}
      inputProps={{
        ...props.inputProps,
        autoComplete: 'tel',
      }}
    />
  );
});

CustomTextField.displayName = 'CustomTextField';

export default function PhoneInput({
  value,
  onChange,
  label = "Phone Number",
  placeholder = "Enter phone number",
  helperText,
  error = false,
  fullWidth = true,
  disabled = false,
}: PhoneInputProps) {
  // Use local state to ensure we always have a controlled value
  const [phoneValue, setPhoneValue] = useState<string>('');

  // Initialize phone value from props
  useEffect(() => {
    // Convert any input to a safe string
    const safeValue = (value || '').toString();
    setPhoneValue(safeValue);
  }, [value]);

  const handleChange = (newValue?: string | null) => {
    // Ensure we always work with strings, never undefined or null
    const safeValue = newValue ? newValue.toString() : '';
    console.log('PhoneInput handleChange - newValue:', newValue, 'safeValue:', safeValue);
    
    setPhoneValue(safeValue);
    
    // Call the parent onChange with the safe value
    if (onChange) {
      onChange(safeValue || undefined);
    }
  };

  // Safely check if the phone number is valid
  let isValid = true;
  if (phoneValue && phoneValue.length > 0) {
    try {
      isValid = isValidPhoneNumber(phoneValue);
    } catch (error) {
      console.warn('Phone validation error:', error);
      isValid = false;
    }
  }
  
  const showError = error || (phoneValue && phoneValue.length > 0 && !isValid);

  return (
    <Box sx={{ position: 'relative', width: fullWidth ? '100%' : 'auto' }}>
      <PhoneInputComponent
        international
        countryCallingCodeEditable={false}
        defaultCountry="US"
        value={phoneValue || ''}
        onChange={handleChange}
        disabled={disabled}
        inputComponent={CustomTextField}
        style={{
          '--PhoneInputCountryFlag-height': '1em',
          '--PhoneInputCountrySelectArrow-color': '#6b7280',
        } as React.CSSProperties}
        numberInputProps={{
          label,
          placeholder,
          helperText: showError && phoneValue && phoneValue.length > 0 && !isValid 
            ? "Please enter a valid phone number" 
            : helperText,
          error: showError,
          fullWidth,
          disabled,
          variant: "outlined" as const,
          sx: {
            '& .MuiOutlinedInput-root': {
              '& fieldset': {
                borderColor: showError ? '#d32f2f' : undefined,
              },
              '&:hover fieldset': {
                borderColor: showError ? '#d32f2f' : undefined,
              },
              '&.Mui-focused fieldset': {
                borderColor: showError ? '#d32f2f' : undefined,
                borderWidth: showError ? 1 : 2,
              },
            },
            '& .MuiFormHelperText-root': {
              color: showError ? '#d32f2f' : undefined,
            },
          }
        }}
      />
      
      {phoneValue && phoneValue.length > 0 && isValid && (
        <Box sx={{ 
          position: 'absolute', 
          right: 12, 
          top: '50%', 
          transform: 'translateY(-50%)',
          color: 'success.main',
          fontSize: '18px',
          pointerEvents: 'none',
          zIndex: 1
        }}>
          ✓
        </Box>
      )}
    </Box>
  );
} 