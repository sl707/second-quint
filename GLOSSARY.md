# Rankings

A ranking site where people pick winners in 1v1 matches between contestants, through bracket tournaments or endless random matchups, and the results feed shared global rankings and each player's personal rankings.

## Language

### Catalog

**Contestant**:
A named entry with a picture, shared across everyone's tournaments, that competes in matches.
_Avoid_: Thing, item, entry, competitor

**Category**:
A subject that groups contestants, such as idols or pizza toppings, with a short description and a cover picture. A contestant can belong to many categories.
_Avoid_: Topic, pool, tag, group

**Merge**:
Combining two duplicate contestants into one, keeping both match histories and all their categories. Done by the admin.

**Report**:
A visitor's flag on a contestant, category, or profile, sent to the admin for possible removal.

### Playing

**Scope**:
What a tournament or Infinite Mode draws its contestants from: either one category or all contestants.

**Match**:
A single 1v1 face-off between two contestants, decided by the person playing picking a winner. A match counts toward its scope's category rankings (if the scope is a category) and the overall rankings.
_Avoid_: Game, round, duel, matchup

**Rated Match**:
A match that counts toward global rankings: every match in a rated tournament, and Infinite Mode matches within the player's rated allowance unless they chose to play unrated. All other matches are unrated.
_Avoid_: Counted match, ranked match

**Rated Allowance**:
How many rated matches one account can record in one scope per day, shared between tournaments and Infinite Mode. It equals the number of contestants in the scope, with a minimum of 20, and at most 500 for the all-contestants scope.
_Avoid_: Quota, cap, daily limit

**Skip**:
Passing on a pair in Infinite Mode without recording a match. Limited to 5 per account per day for rated matches; unlimited for unrated ones.

**Tournament**:
One run through a bracket by one person, drawing its contestants from one scope. It may be left unfinished.
_Avoid_: Bracket (for the whole event), contest, session

**Bracket**:
The single-elimination tree of matches that a tournament follows, including a third-place match.
_Avoid_: Draw

**Bye**:
A free pass through a bracket round, given when the number of contestants isn't a power of two.

**Rated Tournament**:
A tournament with randomly drawn contestants whose matches all fit within the player's remaining rated allowance when it starts. The whole tournament is charged to that day's allowance up front; each match counts toward rankings as it's played, and the tournament never expires. A player can have only one unfinished rated tournament at a time, across all scopes; allowance reserved for matches never played is not returned.

**Give Up**:
Ending an unfinished rated tournament early. Its played matches stay counted, it never gets a tournament ranking, and its reserved allowance stays spent.
_Avoid_: Forfeit, abandon, quit

**Removed Tournament**:
A tournament ended because one of its contestants or its category was deleted. It can't continue and has no tournament ranking; its remaining matches still count.

**Unrated Tournament**:
A tournament that produces a tournament ranking but doesn't affect global rankings, because its contestants were hand-picked, the player chose to play unrated, its matches didn't all fit in the player's remaining rated allowance when it started, or the player isn't signed in.

**Infinite Mode**:
An endless sequence of matches drawn from one scope, with no bracket. Pairs favor contestants with few matches or close ratings, with some randomness.
_Avoid_: Endless mode, free play

### Ranking

**Tournament Ranking**:
The placement order produced by one finished tournament: 1st, 2nd, 3rd, 4th, then tied tiers (5th–8th, 9th–16th, …).
_Avoid_: Results, standings

**Global Ranking**:
A standing of contestants that aggregates match results across everyone's play, accounting for strength of opponents, win-loss record, and confidence, with recent results weighing more.
_Avoid_: Leaderboard, Elo, score, bare "ranking"

**Personal Ranking**:
A standing of contestants built from one player's own matches, computed the same way as a global ranking but with every match weighing equally regardless of age. Contestants the player hasn't judged are listed separately, not ranked. Viewable by anyone on that player's profile.
_Avoid_: My ranking, taste profile

**Score**:
The number a ranking orders contestants by: the low end of the contestant's rating range, so contestants with few matches must prove themselves before rising.
_Avoid_: Rating (the best guess, shown with its range on the contestant's page), points

**Rated Ranking**:
The version of any global or personal ranking built only from rated matches. Shown by default.

**Unrated Ranking**:
The version of any global or personal ranking built from every match played, rated or not, including Infinite Mode, hand-picked and unfinished tournaments, and matches played while signed out.
_Avoid_: Casual ranking, all-matches ranking

**Category Ranking**:
A global or personal ranking of the contestants in one category.

**Overall Ranking**:
A global or personal ranking of every contestant, regardless of category.
_Avoid_: All-category ranking, master ranking

### People

**Profile**:
A player's public page, showing their personal rankings and past tournaments.
_Avoid_: Account page, user page

**Display Name**:
The name a player picks at first sign-in, shown on their profile and wherever they appear. Their real name and email are never shown.
_Avoid_: Username, handle

**Ban**:
The admin blocking a player from playing and adding to the catalog, optionally removing all their matches from rankings.
_Avoid_: Suspension, block
