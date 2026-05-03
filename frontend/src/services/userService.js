import { supabase } from '../supabaseClient';
import { hashPassword } from '../utils/passwordHash';
import { hashSecurityAnswer } from '../utils/securityAnswerHash';
import { sendAdminEmail, sendNewAccountRequest } from './emailService';

export async function createUser(
  email,
  fName,
  lName,
  address,
  dob,
  password,
  role,
  questionId1 = null,
  answer1 = null,
  questionId2 = null,
  answer2 = null,
  questionId3 = null,
  answer3 = null
) {
  try {
    const hashedPassword = await hashPassword(password);

    const hashedAnswer1 = answer1 ? await hashSecurityAnswer(answer1) : null;
    const hashedAnswer2 = answer2 ? await hashSecurityAnswer(answer2) : null;
    const hashedAnswer3 = answer3 ? await hashSecurityAnswer(answer3) : null;

    const { data, error } = await supabase.rpc('create_user_with_actor', {
      p_email:       email,
      p_f_name:      fName,
      p_l_name:      lName,
      p_address:     address,
      p_dob:         dob,
      p_password:    hashedPassword,
      p_role:        role,  // REQUIRED: pass 'administrator' | 'manager' | 'accountant'
      p_questionid1: questionId1,
      p_secanswer1:  hashedAnswer1,
      p_questionid2: questionId2,
      p_secanswer2:  hashedAnswer2,
      p_questionid3: questionId3,
      p_secanswer3:  hashedAnswer3,
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
export async function admin_createUser(
  email,
  fName,
  lName,
  address,
  dob,
  password,
  role,
  questionId1,
  answer1,
  questionId2,
  answer2,
  questionId3,
  answer3,
  changedByUserId
) {
  try {
    const hashedPassword = await hashPassword(password);

    const hashedAnswer1 = answer1 ? await hashSecurityAnswer(answer1) : null;
    const hashedAnswer2 = answer2 ? await hashSecurityAnswer(answer2) : null;
    const hashedAnswer3 = answer3 ? await hashSecurityAnswer(answer3) : null;

    const { data, error } = await supabase.rpc('create_user_with_actor', {
      p_email:       email,
      p_f_name:      fName,
      p_l_name:      lName,
      p_address:     address,
      p_dob:         dob,
      p_password:    hashedPassword,
      p_role:        role,  // REQUIRED: pass 'administrator' | 'manager' | 'accountant'
      p_questionid1: questionId1,
      p_secanswer1:  hashedAnswer1,
      p_questionid2: questionId2,
      p_secanswer2:  hashedAnswer2,
      p_questionid3: questionId3,
      p_secanswer3:  hashedAnswer3,
      p_changed_by: changedByUserId ?? null,
    });

    if (error) {
      console.error('Error creating user (RPC):', error);
      throw error;
    }

    const recipientEmail = String(email || '').trim();
    let accountCreationEmailSent = false;
    if (recipientEmail) {
      const createdRow = Array.isArray(data) ? data[0] : data;
      const createdUserId =
        createdRow?.userID ??
        createdRow?.userid ??
        createdRow?.user_id ??
        createdRow?.id ??
        null;

      let emailRecipient = recipientEmail;
      let username = '';
      let displayName = `${fName || ''} ${lName || ''}`.trim() || 'User';

      try {
        let query = supabase
          .from('user')
          .select('email, fName, lName, username');

        if (createdUserId != null) {
          query = query.eq('userID', createdUserId);
        } else {
          query = query.eq('email', recipientEmail);
        }

        const { data: createdUserRecord, error: createdUserLookupError } = await query.maybeSingle();
        if (createdUserLookupError) {
          throw createdUserLookupError;
        }

        if (createdUserRecord) {
          emailRecipient = String(createdUserRecord.email || recipientEmail).trim() || recipientEmail;
          username = String(createdUserRecord.username || '').trim();
          displayName =
            `${createdUserRecord.fName || ''} ${createdUserRecord.lName || ''}`.trim() ||
            username ||
            displayName;
        }
      } catch (lookupError) {
        console.error('Error looking up newly created user for notification email:', lookupError);
      }

      const subject = 'Your account has been created';
      const message =
        `Hello ${displayName},\n\n` +
        `An administrator has created your Better Finance account.\n\n` +
        `Username: ${username || '(not available)'}\n` +
        `Email: ${emailRecipient}\n\n` +
        'You can now sign in with your account credentials.\n\n' +
        `If you did not expect this account, please contact your administrator.`;

      try {
        await sendAdminEmail(emailRecipient, displayName, subject, message);
        accountCreationEmailSent = true;
      } catch (emailError) {
        console.error('Error sending new account created email:', emailError);
      }
    }

    console.log('Created user JSON:', data);
    return {
      user: data,
      accountCreationEmailSent,
    };
  } catch (err) {
    console.error('Error creating user:', err);
    throw err;
  }
}

export async function createUserRequest(
  email,
  fName,
  lName,
  address,
  dob,
  password,
  questionId1,
  answer1,
  questionId2,
  answer2,
  questionId3,
  answer3,
  changedByUserId
) {
    try {
    const hashedPassword = await hashPassword(password);
    const hashedAnswer1 = answer1 ? await hashSecurityAnswer(answer1) : null;
    const hashedAnswer2 = answer2 ? await hashSecurityAnswer(answer2) : null;
    const hashedAnswer3 = answer3 ? await hashSecurityAnswer(answer3) : null;

    const { data } = await supabase.rpc('create_user_request', {
      p_email:       email,
      p_f_name:      fName,
      p_l_name:      lName,
      p_address:     address,
      p_dob:         dob,
      p_password:    hashedPassword,
      p_questionid1: questionId1,
      p_secanswer1:  hashedAnswer1,
      p_questionid2: questionId2,
      p_secanswer2:  hashedAnswer2,
      p_questionid3: questionId3,
      p_secanswer3:  hashedAnswer3,
    });

    console.log('User request JSON:', data);
    const fullName = `${fName} ${lName}`;

    try {
      await sendNewAccountRequest(fullName);
    } catch (emailError) {
      console.error('Error sending new account request email:', emailError);
    }

    return data;
    } 
    catch (error) {
        console.error('Error creating user request:', error);
        throw error;
    }
}

export async function getSecurityQuestions() {
  try {
    const { data, error } = await supabase.rpc('get_securityquestions');

    if (error) {
      console.error('Error getting security questions (RPC):', error);
      throw error;
    }

    return data || [];
  } catch (err) {
    console.error('Error in getSecurityQuestions:', err);
    throw err;
  }
}

export async function updateUser({
  userId,
  email,
  username,
  passwordHash,
  fName,
  lName,
  dob,
  address,
  picturePath,
  status,
  passwordExpires,
  role,
  suspendedTill,
  loginAttempts,
  changedBy,
}) {
  if (userId == null) {
    throw new Error('updateUser: userId is required');
  }

  const { data, error } = await supabase.rpc('update_user', {
    p_address:         address ?? null,
    p_dob:             dob ?? null,
    p_email:           email ?? null,
    p_fname:           fName ?? null,
    p_lname:           lName ?? null,
    p_loginattempts:   loginAttempts ?? null,
    p_password_hash:   passwordHash ?? null,
    p_passwordexpires: passwordExpires ?? null,
    p_picture_path:    picturePath ?? null,
    p_role:            role ?? null,
    p_status:          typeof status === 'boolean' ? status : null,
    p_suspendedtill:   suspendedTill ?? null,
    p_userid:          userId,
    p_username:        username ?? null,
    p_changed_by:      changedBy ?? null,
  });

  if (error) {
    console.error('Error updating user (RPC):', error);
    throw error;
  }

  return data;
}

export async function updateUserPicturePath({ userId, picturePath }) {
  if (userId == null) {
    throw new Error('updateUserPicturePath: userId is required');
  }

  const { data, error } = await supabase.rpc('update_user_picture_path', {
    p_userid: userId,
    p_picture_path: picturePath ?? null,
  });

  if (error) {
    console.error('Error updating user picture path (RPC):', error);
    throw error;
  }

  return data;
}



export async function getPasswords(){
    const { data, error } = await supabase.rpc('get_userpasswords');

    if (error) {
    console.error(error);
    } else {
    console.log(data);
    }
}

export async function getUser(userId) {
  try {
    const { data, error } = await supabase.rpc('get_user', {
      p_userid: userId,
    });

    if (error) {
      console.error('Error getting user:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in getUser:', error);
    throw error;
  }
}

export async function checkEmail(email){
  try {
    const { data, error } = await supabase.rpc('check_email', { p_email: email });
    if (error) throw error;
    return !!data;
  } catch (error) {
    console.error('Error checking email:', error);
    return false;
  }
}

export async function getUserIdByEmailAndUsername(email, username) {
  try {
    const normalizedEmail = String(email ?? '').trim();
    const normalizedUsername = String(username ?? '').trim();
    if (!normalizedEmail || !normalizedUsername) {
      return null;
    }

    const { data, error } = await supabase
      .from('user')
      .select('userID')
      .eq('email', normalizedEmail)
      .eq('username', normalizedUsername)
      .maybeSingle();

    if (error) {
      console.error('Error looking up user ID by email/username:', error);
      throw error;
    }

    return data?.userID ?? null;
  } catch (error) {
    console.error('Error in getUserIdByEmailAndUsername:', error);
    throw error;
  }
}

export async function getUserSecurityQuestions(email, userId) {
  try {
    const parsedUserId = parseInt(String(userId ?? '').trim(), 10);
    if (Number.isNaN(parsedUserId)) {
      throw new Error('Invalid user ID.');
    }

    const { data, error } = await supabase.rpc('get_user_security_questions', {
      p_email: String(email ?? '').trim(),
      p_userid: parsedUserId,
    });

    if (error) {
      console.error('Error getting security questions:', error);
      throw error;
    }

    // RPC return shape can vary by SQL function definition/client version.
    // Normalize to a stable shape consumed by password-reset/admin pages.
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return null;
    }

    return {
      question1:
        row.question1 ??
        row.question_1 ??
        row.securityquestion1 ??
        row.securityQuestion1 ??
        row.security_question1 ??
        row.questiontext1 ??
        row.question_text1 ??
        '',
      question2:
        row.question2 ??
        row.question_2 ??
        row.securityquestion2 ??
        row.securityQuestion2 ??
        row.security_question2 ??
        row.questiontext2 ??
        row.question_text2 ??
        '',
      question3:
        row.question3 ??
        row.question_3 ??
        row.securityquestion3 ??
        row.securityQuestion3 ??
        row.security_question3 ??
        row.questiontext3 ??
        row.question_text3 ??
        '',
    };
  } catch (error) {
    console.error('Error in getUserSecurityQuestions:', error);
    throw error;
  }
}

export async function verifySecurityAnswers(email, userId, answer1, answer2, answer3) {
  try {
    const hashedAnswer1 = await hashSecurityAnswer(answer1);
    const hashedAnswer2 = await hashSecurityAnswer(answer2);
    const hashedAnswer3 = await hashSecurityAnswer(answer3);

    const { data, error } = await supabase.rpc('verify_security_answers', {
      p_email: email,
      p_userid: parseInt(userId, 10),
      p_answer1: hashedAnswer1,
      p_answer2: hashedAnswer2,
      p_answer3: hashedAnswer3,
    });

    if (error) {
      console.error('Error verifying security answers:', error);
      throw error;
    }

    return !!data;
  } catch (error) {
    console.error('Error in verifySecurityAnswers:', error);
    return false;
  }
}

export async function isPasswordReused(userId, newPassword) {
  try {
    const hashedPassword = await hashPassword(newPassword);

    const { data, error } = await supabase.rpc('is_password_reused', {
      p_userid: parseInt(userId, 10),
      p_new_password_hash: hashedPassword,
    });

    if (error) {
      console.error('Error checking password reuse (RPC):', error);
      throw error;
    }

    return !!data;
  } catch (err) {
    console.error('Error in isPasswordReused:', err);
    throw err;
  }
}

export async function updateUserPassword(userId, newPassword) {
  try {
    const hashedPassword = await hashPassword(newPassword);

    const { data, error } = await supabase.rpc('update_user_password', {
      p_userid: userId,
      p_new_password_hash: hashedPassword,
    });

    if (error) {
      console.error('Error updating user password (RPC):', error);
      throw error;
    }

    // Send a confirmation email after a successful password reset/update.
    try {
      const { data: userRecord, error: userLookupError } = await supabase
        .from('user')
        .select('email, fName, lName, username')
        .eq('userID', userId)
        .maybeSingle();

      if (userLookupError) {
        throw userLookupError;
      }

      const recipientEmail = String(userRecord?.email ?? '').trim();
      if (recipientEmail) {
        const username = String(userRecord?.username ?? '').trim();
        const displayName =
          `${userRecord?.fName ?? ''} ${userRecord?.lName ?? ''}`.trim() ||
          username ||
          'User';

        const subject = 'Your password was reset';
        const message =
          `Hello ${displayName},\n\n` +
          'This is a confirmation that your Better Finance password was recently reset.\n\n' +
          `Username: ${username || '(not available)'}\n` +
          `Email: ${recipientEmail}\n\n` +
          'If you made this change, no further action is required.\n' +
          'If you did not request this change, contact your administrator immediately.';

        await sendAdminEmail(recipientEmail, displayName, subject, message);
      } else {
        console.warn('Password reset email not sent: user email is missing.');
      }
    } catch (notifyError) {
      console.error('Error sending password reset confirmation email:', notifyError);
    }

    return data;
  } catch (err) {
    console.error('Error in updateUserPassword:', err);
    throw err;
  }
}

export async function adminUpdateUserSecurityAnswers(userId, answer1, answer2, answer3) {
  try {
    const hashedAnswer1 = answer1 ? await hashSecurityAnswer(answer1) : null;
    const hashedAnswer2 = answer2 ? await hashSecurityAnswer(answer2) : null;
    const hashedAnswer3 = answer3 ? await hashSecurityAnswer(answer3) : null;

    const { data, error } = await supabase.rpc('admin_update_user_security_answers', {
      p_userid: parseInt(userId, 10),
      p_secanswer1: hashedAnswer1,
      p_secanswer2: hashedAnswer2,
      p_secanswer3: hashedAnswer3,
    });

    if (error) {
      console.error('Error updating user security answers (RPC):', error);
      throw error;
    }

    return data;
  } catch (err) {
    console.error('Error in adminUpdateUserSecurityAnswers:', err);
    throw err;
  }
}
export async function getAllUserRequests() {
  try {
    const { data, error } = await supabase.rpc('get_all_user_requests');

    if (error) {
      console.error('Error getting user requests (RPC):', error);
      throw error;
    }
    return data || [];
  } catch (err) {
    console.error('Error in getAllUserRequests:', err);
    throw err;
  }
}

export async function approveUserRequest(userRequestId, role, changedByUserId) {
  try {
    const { data, error } = await supabase.rpc('approve_user_request_with_actor', {
      p_userrequest_id: userRequestId,
      p_role: role,
      p_changed_by: changedByUserId ?? null,
    });

    if (error) {
      console.error('Error approving user request (RPC):', error);
      throw error;
    }

    let accountCreationEmailSent = false;
    try {
      const approvedRow = Array.isArray(data) ? data[0] : data;
      const approvedUserId =
        approvedRow?.userID ??
        approvedRow?.userid ??
        approvedRow?.user_id ??
        approvedRow?.approved_user_id ??
        approvedRow?.new_user_id ??
        approvedRow?.id ??
        null;
      const fallbackEmail = String(approvedRow?.email || '').trim();

      let query = supabase
        .from('user')
        .select('email, fName, lName, username');

      if (approvedUserId != null) {
        query = query.eq('userID', approvedUserId);
      } else if (fallbackEmail) {
        query = query.eq('email', fallbackEmail);
      } else {
        query = null;
      }

      if (query) {
        const { data: approvedUserRecord, error: approvedUserLookupError } = await query.maybeSingle();
        if (approvedUserLookupError) {
          throw approvedUserLookupError;
        }

        const recipientEmail = String(approvedUserRecord?.email || fallbackEmail).trim();
        if (recipientEmail) {
          const username = String(approvedUserRecord?.username || '').trim();
          const displayName =
            `${approvedUserRecord?.fName || ''} ${approvedUserRecord?.lName || ''}`.trim() ||
            username ||
            'User';

          const subject = 'Your account request was approved';
          const message =
            `Hello ${displayName},\n\n` +
            'Your Better Finance account request was approved by an administrator.\n\n' +
            `Username: ${username || '(not available)'}\n` +
            `Email: ${recipientEmail}\n\n` +
            'You can now sign in with your account credentials.\n\n' +
            'If you did not request this account, contact your administrator.';

          await sendAdminEmail(recipientEmail, displayName, subject, message);
          accountCreationEmailSent = true;
        } else {
          console.warn('Approval email not sent: approved user email is missing.');
        }
      } else {
        console.warn('Approval email not sent: could not resolve approved user identity.');
      }
    } catch (notifyError) {
      console.error('Error sending approved account email:', notifyError);
    }

    return {
      user: data,
      accountCreationEmailSent,
    };
  } catch (err) {
    console.error('Error in approveUserRequest:', err);
    throw err;
  }
}

export async function rejectUserRequest(userRequestId, changedByUserId) {
  try {
    const { data, error } = await supabase.rpc('reject_user_request_with_actor', {
      p_userrequest_id: userRequestId,
      p_changed_by: changedByUserId ?? null,
    });

    if (error) {
      console.error('Error rejecting user request (RPC):', error);
      throw error;
    }

    return data;
  } catch (err) {
    console.error('Error in rejectUserRequest:', err);
    throw err;
  }
}