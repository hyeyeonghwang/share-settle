from fastapi import APIRouter, Depends, Response, status
from fastapi.security import HTTPAuthorizationCredentials

from ..auth import _bearer, optional_user, require_user
from ..models import DemoSignIn, LoginInput, RegisterInput, User
from ..store import store

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/me", response_model=User | None)
def me(user: User | None = Depends(optional_user)) -> User | None:
    return user


@router.post("/google", response_model=User)
def google(response: Response) -> User:
    user, token = store.sign_in("u_younghee")
    response.headers["X-Auth-Token"] = token
    return user


@router.post("/register", response_model=User, status_code=201)
def register(body: RegisterInput, response: Response) -> User:
    user, token = store.register(body)
    response.headers["X-Auth-Token"] = token
    return user


@router.post("/login", response_model=User)
def login(body: LoginInput, response: Response) -> User:
    user, token = store.sign_in_with_password(body)
    response.headers["X-Auth-Token"] = token
    return user


@router.post("/demo", response_model=User)
def demo(body: DemoSignIn, response: Response) -> User:
    user, token = store.sign_in(body.userId)
    response.headers["X-Auth-Token"] = token
    return user


@router.get("/demo/accounts", response_model=list[User])
def demo_accounts() -> list[User]:
    return store.all_users()


@router.post("/signout", status_code=status.HTTP_204_NO_CONTENT)
def signout(credentials: HTTPAuthorizationCredentials = Depends(_bearer), user: User = Depends(require_user)) -> Response:
    store.revoke_token(credentials.credentials)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
