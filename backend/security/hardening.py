# SecureFight Defense (Mass Assignment)
# Decision: propose (confidence 0.68)
# Mitigation: Layered validation, authorization checks, and secure defaults reduce exploitability for this vector.
# Patch hint:
# + # Add deny-by-default authorization check
# + # Add allowlist validation for untrusted input
# + # Add request throttling for high-risk routes

# SecureFight Defense (API Key Leakage)
# Decision: propose (confidence 0.52)
# Mitigation: Layered validation, authorization checks, and secure defaults reduce exploitability for this vector.
# Patch hint:
# + # Add deny-by-default authorization check
# + # Add allowlist validation for untrusted input
# + # Add request throttling for high-risk routes

# SecureFight Defense (Rate Limit Abuse)
# Decision: propose (confidence 0.68)
# Mitigation: Layered validation, authorization checks, and secure defaults reduce exploitability for this vector.
# Patch hint:
# + # Add deny-by-default authorization check
# + # Add allowlist validation for untrusted input
# + # Add request throttling for high-risk routes

# SecureFight Defense (JWT Tampering)
# Decision: propose (confidence 0.52)
# Mitigation: Layered validation, authorization checks, and secure defaults reduce exploitability for this vector.
# Patch hint:
# + # Add deny-by-default authorization check
# + # Add allowlist validation for untrusted input
# + # Add request throttling for high-risk routes

# SecureFight Defense (Broken Auth)
# Decision: propose (confidence 0.68)
# Mitigation: Layered validation, authorization checks, and secure defaults reduce exploitability for this vector.
# Patch hint:
# + # Add deny-by-default authorization check
# + # Add allowlist validation for untrusted input
# + # Add request throttling for high-risk routes

# Add deny-by-default authorization check
# Add allowlist validation for untrusted input
# Add request throttling for high-risk routes
if invoice.account_id != current_user.account_id:
    raise HTTPException(status_code=403, detail='Forbidden')
