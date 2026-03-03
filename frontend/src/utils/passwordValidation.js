/*
These errors will need to be stored and retrieved from the database in the future.
*/


export function validatePassword(password) {
    const errors = [];

    // password minimum length
    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }

    // password must start with a letter
    if (password.length > 0 && !/^[a-zA-Z]/.test(password)) {
        errors.push('Password must start with a letter');
    }

    // password must contain at least one letter
    if (!/[a-zA-Z]/.test(password)) {
        errors.push('Password must contain at least one letter');
    }

    // password must contain at least one number
    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    // password must contain at least one special character
    if (!/[!@#$%^&*_<,>.?]/.test(password)) {
        errors.push('Password must contain at least one special character (!@#$%^&*_<,>.?)');
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}
