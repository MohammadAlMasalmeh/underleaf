claims = jwt.decode(
    token,
    key=JWT_PUBLIC_KEY,
    algorithms=['RS256'],
    options={'require': ['exp', 'iat', 'sub']},
)
if claims.get('iss') != JWT_ISSUER:
    raise HTTPException(status_code=401, detail='Invalid token issuer')
