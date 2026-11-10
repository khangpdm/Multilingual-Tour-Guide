import threading
from collections import defaultdict, deque

mutation_lock = threading.RLock()
login_attempts = defaultdict(deque)