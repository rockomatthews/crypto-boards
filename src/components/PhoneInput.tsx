'use client';

import React, { useState, useEffect } from 'react';
import { TextField, Box, MenuItem, InputAdornment } from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';

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

// Common country codes
const countryCodes = [
  { code: '+1', country: 'US', flag: '🇺🇸' },
  { code: '+1', country: 'CA', flag: '🇨🇦' },
  { code: '+44', country: 'GB', flag: '🇬🇧' },
  { code: '+33', country: 'FR', flag: '🇫🇷' },
  { code: '+49', country: 'DE', flag: '🇩🇪' },
  { code: '+81', country: 'JP', flag: '🇯🇵' },
  { code: '+86', country: 'CN', flag: '🇨🇳' },
  { code: '+91', country: 'IN', flag: '🇮🇳' },
  { code: '+61', country: 'AU', flag: '🇦🇺' },
  { code: '+55', country: 'BR', flag: '🇧🇷' },
];

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
  const [countryCode, setCountryCode] = useState('+1');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Parse existing value
  useEffect(() => {
    if (value) {
      const phoneStr = value.toString();
      // Try to extract country code
      const foundCountry = countryCodes.find(c => phoneStr.startsWith(c.code));
      if (foundCountry) {
        setCountryCode(foundCountry.code);
        setPhoneNumber(phoneStr.substring(foundCountry.code.length));
      } else {
        setPhoneNumber(phoneStr);
      }
    } else {
      setPhoneNumber('');
    }
  }, [value]);

  // Simple phone number validation
  const isValidPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
  };

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else if (cleaned.length <= 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    }
  };

  const handlePhoneChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target.value;
    const formatted = formatPhoneNumber(input);
    setPhoneNumber(formatted);
    
    // Combine country code and phone number
    const fullNumber = countryCode + formatted.replace(/\D/g, '');
    console.log('Phone change:', { countryCode, formatted, fullNumber });
    
    if (onChange) {
      onChange(fullNumber);
    }
  };

  const handleCountryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newCountryCode = event.target.value;
    setCountryCode(newCountryCode);
    
    // Update full number with new country code
    const fullNumber = newCountryCode + phoneNumber.replace(/\D/g, '');
    console.log('Country change:', { newCountryCode, phoneNumber, fullNumber });
    
    if (onChange) {
      onChange(fullNumber);
    }
  };

  const isValid = phoneNumber ? isValidPhone(phoneNumber) : true;
  const showError = error || (phoneNumber.length > 0 && !isValid);

  return (
    <Box sx={{ display: 'flex', gap: 1, width: fullWidth ? '100%' : 'auto' }}>
      {/* Country Code Selector */}
      <TextField
        select
        value={countryCode}
        onChange={handleCountryChange}
        disabled={disabled}
        sx={{ minWidth: 120 }}
        variant="outlined"
      >
        {countryCodes.map((country) => (
          <MenuItem key={`${country.code}-${country.country}`} value={country.code}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <span>{country.flag}</span>
              <span>{country.code}</span>
            </Box>
          </MenuItem>
        ))}
      </TextField>

      {/* Phone Number Input */}
      <TextField
        label={label}
        placeholder={placeholder}
        value={phoneNumber}
        onChange={handlePhoneChange}
        error={showError}
        helperText={showError && phoneNumber && !isValid 
          ? "Please enter a valid phone number" 
          : helperText}
        disabled={disabled}
        fullWidth
        variant="outlined"
        InputProps={{
          ...(phoneNumber && isValid && {
            endAdornment: (
              <InputAdornment position="end">
                <CheckIcon sx={{ color: 'success.main' }} />
              </InputAdornment>
            ),
          }),
        }}
      />
    </Box>
  );
} 