"""Brute-force protection for ``POST /api/auth/login``.

After ``LOGIN_MAX_ATTEMPTS`` failed logins for the same username from the same
client address within ``LOGIN_WINDOW_SECONDS``, further attempts get ``429``
until the oldest failure ages out. A successful login clears the counter.

State is kept in memory, so it is per backend process. That is enough for one
container; several instances behind a load balancer would need a shared store
(e.g. Redis) to count attempts together.
"""

import math
import os
import threading
import time
from collections import deque
from collections.abc import Callable

MAX_ATTEMPTS = int(os.getenv("LOGIN_MAX_ATTEMPTS", "5"))
WINDOW_SECONDS = int(os.getenv("LOGIN_WINDOW_SECONDS", "900"))


class LoginRateLimiter:
    def __init__(
        self,
        max_attempts: int = MAX_ATTEMPTS,
        window_seconds: int = WINDOW_SECONDS,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._clock = clock
        self._failures: dict[tuple[str, str], deque[float]] = {}
        self._lock = threading.Lock()

    @staticmethod
    def _key(client: str | None, username: str) -> tuple[str, str]:
        return (client or "unknown", username.strip().lower())

    def _recent(self, key: tuple[str, str], now: float) -> deque[float]:
        failures = self._failures.setdefault(key, deque())
        while failures and now - failures[0] >= self.window_seconds:
            failures.popleft()
        return failures

    def retry_after(self, client: str | None, username: str) -> int | None:
        """Seconds to wait before trying again, or ``None`` if a login attempt is allowed."""
        with self._lock:
            now = self._clock()
            failures = self._recent(self._key(client, username), now)
            if len(failures) < self.max_attempts:
                return None
            return max(1, math.ceil(self.window_seconds - (now - failures[0])))

    def record_failure(self, client: str | None, username: str) -> None:
        with self._lock:
            now = self._clock()
            self._recent(self._key(client, username), now).append(now)

    def record_success(self, client: str | None, username: str) -> None:
        with self._lock:
            self._failures.pop(self._key(client, username), None)

    def reset(self) -> None:
        """Forget all attempts (used by tests)."""
        with self._lock:
            self._failures.clear()


login_limiter = LoginRateLimiter()
