claims = verify_refresh_token(refresh_token)
token_id = claims.get('jti')
if not token_id or token_store.is_revoked(token_id):
    raise HTTPException(status_code=401, detail='Invalid refresh token')
token_store.revoke(token_id)
new_refresh = issue_refresh_token(user_id=claims['sub'])
