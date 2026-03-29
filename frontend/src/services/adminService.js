import { supabase } from '../supabaseClient'

export const getAllUsers = async () => {
  const { data, error } = await supabase
    .from('user')
    .select('*')
    .order('userID', {ascending: true})
  if (error) {
    console.error(error)
    throw error
  }

  return data
}

export const getEmailRecipientsByRoles = async (roles = ['manager', 'accountant', 'administrator']) => {
  const { data, error } = await supabase
    .from('user')
    .select('userID, email, fName, lName, username, role')
    .in('role', roles)
    .eq('status', true)
    .order('lName', { ascending: true })

  if (error) {
    console.error(error)
    throw error
  }

  return (data || []).filter((u) => u.email && String(u.email).trim().length > 0)
}

export const getExpiredPasswords = async () => {
  const today = new Date().toISOString()

  const { data, error } = await supabase
    .from('userPasswords')
    .select('*')
    .lt('activeTill', today)

  if (error) {
    console.error(error)
    throw error
  }

  return data
}

export const suspendUser = async (userID, startDate, endDate) => {
  const { data, error } = await supabase
    .from('user')
    .update({
      suspendFrom: startDate,
      suspendedTill: endDate,
      status: false
    })
    .eq('userID', userID)
    .select()

  if (error) {
    console.error("Supabase suspend error:", error)
    throw error
  }

  if (!data || data.length === 0) {
    throw new Error("User not found.")
  }

  return data
}