
-- Restrict SECURITY DEFINER trigger functions from being called by API roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;

-- risk_settings: explicitly deny DELETE (no user should remove their risk config)
CREATE POLICY "Deny delete on risk settings"
ON public.risk_settings
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (false);

-- trade_executions: audit log — disallow UPDATE/DELETE to preserve history
CREATE POLICY "Deny update on trade executions"
ON public.trade_executions
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny delete on trade executions"
ON public.trade_executions
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (false);
