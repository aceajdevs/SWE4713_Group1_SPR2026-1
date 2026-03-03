import { supabase } from '../supabaseClient';
import { hashPassword } from '../utils/passwordHash';
import { sendNewAccountRequest } from './emailService';
export async function createUser(email, fName, lName, address, dob, password, role) {
  try {
    const hashedPassword = await hashPassword(password);

    const { data, error } = await supabase.rpc('create_user', {
      p_email:    email,
      p_f_name:   fName,
      p_l_name:   lName,
      p_address:  address,
      p_dob:      dob,
      p_password: hashedPassword,
      p_role:     role,  // REQUIRED: pass 'administrator' | 'manager' | 'accountant'
    });

    if (error) {
      console.error('Error creating user (RPC):', error);
      throw error;
    }

    console.log('Created user JSON:', data);
    return data;
  } catch (err) {
    console.error('Error creating user:', err);
    throw err;
  }
}

export async function createUserRequest(email, fName, lName, address, dob, password, questionId1, answer1, questionId2, answer2, questionId3, answer3){
    try {
        const hashedPassword = await hashPassword(password);
        const { data, error } = await supabase.rpc('create_user_request', {
            p_email:       email,
            p_f_name:      fName,
            p_l_name:      lName,
            p_address:     address,
            p_dob:         dob,           // 'YYYY-MM-DD'
            p_password:    hashedPassword,
            p_questionid1: questionId1,
            p_secanswer1:  answer1,
            p_questionid2: questionId2,
            p_secanswer2:  answer2,
            p_questionid3: questionId3,
            p_secanswer3:  answer3,
          });
        
        console.log('User request JSON:', data);
        const fullName = `${fName} ${lName}`
        //sendNewAccountRequest(fullName);
        return data;    
    } 
    catch (error) {
        console.error('Error creating user request:', error);
        throw error;
    }
}

export async function getPasswords(){
    const { data, error } = await supabase.rpc('get_userpasswords');

    if (error) {
    console.error(error);
    } else {
    console.log(data);
    }
}
