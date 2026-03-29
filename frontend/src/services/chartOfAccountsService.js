import { supabase } from '../supabaseClient';

export async function createChartAccountWithActor(accountData, actorUserId) {
  const { data, error } = await supabase.rpc('create_chart_account_with_actor', {
    p_account_name: accountData.accountName,
    p_account_number: accountData.accountNumber,
    p_description: accountData.description ?? null,
    p_normal_side: accountData.normalSide ?? null,
    p_type: accountData.type ?? null,
    p_sub_type: accountData.subType ?? null,
    p_order_number: accountData.orderNumber ?? null,
    p_init_balance: accountData.initBalance ?? null,
    p_active: accountData.active ?? true,
    p_statement_type: accountData.statementType ?? null,
    p_actor_userid: actorUserId,
  });

  if (error) throw error;
  return data;
}

export async function updateChartAccountWithActor(accountId, accountData, actorUserId) {
  const { data, error } = await supabase.rpc('update_chart_account_with_actor', {
    p_account_id: accountId,
    p_account_name: accountData.accountName,
    p_account_number: accountData.accountNumber,
    p_description: accountData.description ?? null,
    p_normal_side: accountData.normalSide ?? null,
    p_type: accountData.type ?? null,
    p_sub_type: accountData.subType ?? null,
    p_order_number: accountData.orderNumber ?? null,
    p_init_balance: accountData.initBalance ?? null,
    p_active: accountData.active ?? true,
    p_statement_type: accountData.statementType ?? null,
    p_actor_userid: actorUserId,
  });

  if (error) throw error;
  return data;
}

export async function setChartAccountActiveWithActor(accountId, isActive, actorUserId) {
  const { data, error } = await supabase.rpc('set_chart_account_active_with_actor', {
    p_account_id: accountId,
    p_active: isActive,
    p_actor_userid: actorUserId,
  });

  if (error) throw error;
  return data;
}

export async function fetchChartAccountEventLog(accountId) {
  const { data, error } = await supabase.rpc('get_chart_of_accounts_event_log', {
    p_account_id: accountId,
  });
  if (error) throw error;
  return data ?? [];
}

