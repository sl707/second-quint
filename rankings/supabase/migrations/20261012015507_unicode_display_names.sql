-- Display names may use letters and digits from any script, and single spaces between words, as
-- well as _ and -: 3 to 24 characters, NFC-composed, no spaces at either end. Uniqueness still
-- ignores case (display_name_key is lower(display_name)). The character classes follow the
-- database's Unicode-aware locale (en_US.UTF-8), like lower().

alter table public.players drop constraint players_display_name_check;
alter table public.players add constraint players_display_name_check check (
  char_length(display_name) between 3 and 24
  and display_name is nfc normalized
  and display_name ~ '^[[:alpha:][:digit:]_-]+( [[:alpha:][:digit:]_-]+)*$'
);
