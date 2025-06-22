'use client';

import React, { forwardRef } from 'react';
import { TextField, Box, TextFieldProps } from '@mui/material';
import PhoneInputComponent from 'react-phone-number-input';
import { isValidPhoneNumber } from 'libphonenumber-js';
import 'react-phone-number-input/style.css';

interface PhoneInputProps {
  value?: string;
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
  value = '',
  onChange,
  label = "Phone Number",
  placeholder = "Enter phone number",
  helperText,
  error = false,
  fullWidth = true,
  disabled = false,
}: PhoneInputProps) {
  const handleChange = (phoneValue?: string) => {
    // Ensure we always pass a string or undefined, never null
    onChange?.(phoneValue || '');
  };

  // Safely check if the phone number is valid
  const isValid = value && value.length > 0 ? isValidPhoneNumber(value) : true;
  const showError = error || (value && value.length > 0 && !isValid);

  return (
    <Box sx={{ position: 'relative' }}>
      <style jsx global>{`
        .PhoneInput {
          display: flex;
          align-items: stretch;
          gap: 8px;
        }
        
        .PhoneInputCountry {
          display: flex;
          align-items: center;
          padding: 14px 12px;
          border: 1px solid ${showError ? '#d32f2f' : '#c4c4c4'};
          border-radius: 4px;
          background: ${disabled ? '#f5f5f5' : 'white'};
          cursor: ${disabled ? 'not-allowed' : 'pointer'};
          min-width: 90px;
          justify-content: center;
          transition: border-color 0.2s ease;
        }
        
        .PhoneInputCountry:hover {
          border-color: ${showError ? '#d32f2f' : '#1976d2'};
        }
        
        .PhoneInputCountry:focus-within {
          border-color: ${showError ? '#d32f2f' : '#1976d2'};
          border-width: 2px;
          outline: none;
        }
        
        .PhoneInputCountryIcon {
          width: 20px;
          height: 15px;
          margin-right: 8px;
          border-radius: 2px;
          object-fit: cover;
          border: 1px solid rgba(0,0,0,0.1);
        }
        
        .PhoneInputCountrySelect {
          border: none;
          background: transparent;
          font-size: 14px;
          font-weight: 500;
          color: ${disabled ? '#999' : '#333'};
          cursor: ${disabled ? 'not-allowed' : 'pointer'};
          outline: none;
          appearance: none;
          padding-right: 16px;
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
          background-position: right 4px center;
          background-repeat: no-repeat;
          background-size: 16px;
        }
        
        .PhoneInputInput {
          flex: 1;
        }
        
        .PhoneInput--focus .PhoneInputCountry {
          border-color: ${showError ? '#d32f2f' : '#1976d2'};
          border-width: 2px;
        }
      `}</style>
      
      <PhoneInputComponent
        international
        countryCallingCodeEditable={false}
        defaultCountry="US"
        value={value || ''}
        onChange={handleChange}
        disabled={disabled}
        inputComponent={CustomTextField}
        numberInputProps={{
          label,
          placeholder,
          helperText: showError && value && value.length > 0 && !isValid 
            ? "Please enter a valid phone number" 
            : helperText,
          error: showError,
          fullWidth,
          disabled,
          variant: "outlined" as const,
          sx: {
            '& .MuiOutlinedInput-root': {
              '& fieldset': {
                borderColor: showError ? '#d32f2f' : '#c4c4c4',
              },
              '&:hover fieldset': {
                borderColor: showError ? '#d32f2f' : '#1976d2',
              },
              '&.Mui-focused fieldset': {
                borderColor: showError ? '#d32f2f' : '#1976d2',
                borderWidth: 2,
              },
            },
            '& .MuiFormHelperText-root': {
              color: showError ? '#d32f2f' : 'inherit',
            },
          }
        }}
      />
      
      {value && value.length > 0 && isValid && (
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