API DOCS: https://api.grandarena.gg/docs/#/

CHANGELOG:

# BREAKING

Renamed `tokenId` to `mokiTokenId` and `cardId` to `cardTokenId` in all response bodies, path params, query params, and sort values.

GET /api/v1/mokis
GET /api/v1/mokis/{mokiTokenId}
GET /api/v1/mokis/{mokiTokenId}/performances
GET /api/v1/mokis/{mokiTokenId}/training-history
GET /api/v1/mokis/{mokiTokenId}/stats
GET /api/v1/cards
GET /api/v1/card-defs
GET /api/v1/matches/{id}/performances
GET /api/v1/matches/{id}/stats
GET /api/v1/leaderboards/{id}/scores
GET /api/v1/scores/leaderboards/{id}/rankings

# BREAKING

Now requires a narrowing filter: `matchDate` or `mokiId`. Returns 400 if only broad filters like `state` or `gameType` are provided.

GET /api/v1/matches

# BREAKING

Now requires a narrowing filter: `matchDate`, `mokiId`, or `matchId`. Returns 400 if missing.

GET /api/v1/performances

# BREAKING

Response changed from flat array to paginated format with `data` and `pagination` fields.

GET /api/v1/leaderboards/active

# BREAKING

Boolean query params now accept `"true"` / `"false"` strings only. Previously `?isBye=false` was coerced to `true`.

All boolean query params (`isBye`, `minted`, `burned`, `locked`, `cancelled`, `completed`)

# BREAKING

`team` and `teamWon` changed from numeric (0/1) to string (`"red"` / `"blue"`).

GET /api/v1/matches/{id}
GET /api/v1/matches/{id}/performances
GET /api/v1/matches/{id}/stats

# BREAKING

Renamed internal field names in Scores responses: `nftAiId` → `mokiId`, `kills` → `eliminations`, `ballsScored` → `deposits`, `wortDistance` → `wartDistance`.

GET /api/v1/scores/leaderboards/{id}/rankings
GET /api/v1/scores/leaderboards/{leaderboardId}/matches/{matchId}
GET /api/v1/scores/leaderboards/{leaderboardId}/mokis/{mokiId}/rank

# BREAKING

Query param `matchGroup` replaced with `matchDate` (YYYY-MM-DD format).

GET /api/v1/matches
GET /api/v1/performances

# BREAKING

Removed `owner` field from responses and `owner` query param. Use `ownerAddress` instead.

GET /api/v1/cards
GET /api/v1/mokis

---

# ADDED

New contest endpoints: list, detail, active, entries (leaderboard), and payouts.

GET /api/v1/contests
GET /api/v1/contests/{id}
GET /api/v1/contests/active
GET /api/v1/contests/{id}/entries
GET /api/v1/contests/{id}/payouts

# ADDED

List matches for a contest. Supports `state` filter and pagination.

GET /api/v1/contests/{id}/matches

# ADDED

Aggregate moki stats: `matchCount`, `wins`, `losses`, `winRate`, `avgDeposits`, `avgEliminations`, `avgWartDistance`, `winsByType`.

GET /api/v1/mokis/{mokiTokenId}/stats

# ADDED

Match results and performances now include optional stats: `deaths`, `endedGame`, `eatingWhileRiding`, `buffTimeSeconds`, `wartRideTimeSeconds`, `looseBallPickups`, `eatenByWart`, `wartCloser`, and `gameEndedBy`.

GET /api/v1/matches/{id}
GET /api/v1/performances

# ADDED

New query params: `state` (scheduled/scored) and `mokiId`.

GET /api/v1/matches

# ADDED

Response now includes `cancelled` boolean field.

GET /api/v1/trainings

# ADDED

New scoring method value: `s1_v4`.

All endpoints returning `scoringMethod`

---

# FIXED

Rank computation improved across all ranked endpoints.

GET /api/v1/contests/{id}/entries
GET /api/v1/users/{address}/entries
GET /api/v1/leaderboards/{id}/scores

# FIXED

Returns HTTP 202 when match is not yet scored.

GET /api/v1/matches/{id}/stats

# FIXED

`ownerAddress` filter now correctly resolves wallet addresses.

GET /api/v1/cards

---

# REMOVED

Deprecated underutilized endpoints.

GET /api/v1/pack-defs
GET /api/v1/leaderboards/{id}/movers
GET /api/v1/mokis/{mokiTokenId}/stats-progression
