import bcrypt from 'bcryptjs';

export async function hashPassword(password){
    const hash = await bcrypt.hash(password, 10);
    return hash;
}
