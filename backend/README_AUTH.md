# Authentication and API Access Instructions for Friendly Banks Backend

This document explains how to authenticate and access the protected API endpoints using JWT tokens.

## Obtain JWT Token

Send a POST request to the token obtain endpoint with valid user credentials:

```
POST /api/token/
Content-Type: application/json

{
  "username": "your_username",
  "password": "your_password"
}
```

Response:

```json
{
  "refresh": "your_refresh_token",
  "access": "your_access_token"
}
```

## Use Access Token

Include the access token in the Authorization header for subsequent API requests:

```
Authorization: Bearer your_access_token
```

Example using curl:

```
curl -H "Authorization: Bearer your_access_token" http://localhost:8000/api/members/
```

## Refresh Token

To refresh the access token, send a POST request to the token refresh endpoint:

```
POST /api/token/refresh/
Content-Type: application/json

{
  "refresh": "your_refresh_token"
}
```

Response:

```json
{
  "access": "new_access_token"
}
```

## Notes

- All API endpoints except the token obtain and refresh require authentication.
- Ensure CORS settings allow your frontend origin.
- For testing, you can use tools like Postman or curl.

If you need further assistance with testing or scripts, please ask.
