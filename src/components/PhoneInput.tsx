'use client';

import React from 'react';
import { TextField, Box } from '@mui/material';
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
  const handleChange = (phoneValue?: string) => {
    onChange?.(phoneValue);
  };

  const isValid = value ? isValidPhoneNumber(value) : true;
  const showError = error || (value && !isValid);

  return (
    <Box sx={{ position: 'relative' }}>
      <style jsx global>{`
        .PhoneInput {
          display: flex;
          align-items: center;
        }
        
        .PhoneInputCountry {
          display: flex;
          align-items: center;
          margin-right: 8px;
          padding: 8px;
          border: 1px solid #c4c4c4;
          border-radius: 4px;
          background: white;
          cursor: pointer;
          min-width: 80px;
          justify-content: center;
        }
        
        .PhoneInputCountry:hover {
          border-color: #1976d2;
        }
        
        .PhoneInputCountry:focus-within {
          border-color: #1976d2;
          border-width: 2px;
          outline: none;
        }
        
        .PhoneInputCountryIcon {
          width: 20px;
          height: 15px;
          margin-right: 6px;
          border-radius: 2px;
          object-fit: cover;
        }
        
        .PhoneInputCountrySelect {
          border: none;
          background: transparent;
          font-size: 14px;
          font-weight: 500;
          color: #333;
          cursor: pointer;
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
          border-color: #1976d2;
          border-width: 2px;
        }
        
        ${showError ? `
        .PhoneInputCountry {
          border-color: #d32f2f !important;
        }
        .PhoneInput--focus .PhoneInputCountry {
          border-color: #d32f2f !important;
        }
        ` : ''}
        
        ${disabled ? `
        .PhoneInputCountry {
          background-color: #f5f5f5;
          border-color: #e0e0e0;
          cursor: not-allowed;
        }
        .PhoneInputCountrySelect {
          cursor: not-allowed;
          color: #999;
        }
        ` : ''}
      `}</style>
      
      <PhoneInputComponent
        international
        countryCallingCodeEditable={false}
        defaultCountry="US"
        value={value}
        onChange={handleChange}
        disabled={disabled}
        inputComponent={TextField}
        inputProps={{
          label,
          placeholder,
          helperText: showError && value && !isValid 
            ? "Please enter a valid phone number" 
            : helperText,
          error: showError,
          fullWidth,
          disabled,
          variant: "outlined",
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
      
      {value && isValid && (
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