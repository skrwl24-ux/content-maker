-- Missing K-apt details are unknown, not "0 households".
-- Keep basic-data failure metrics for every future region synchronization.
ALTER TABLE public.apt_sync_runs
  ADD COLUMN IF NOT EXISTS kapt_detail_missing_count integer,
  ADD COLUMN IF NOT EXISTS kapt_detail_error_count integer,
  ADD COLUMN IF NOT EXISTS kapt_address_missing_count integer;

COMMENT ON COLUMN public.apt_sync_runs.kapt_detail_missing_count IS
  'K-apt individual detail calls yielding no data in this sync.';
COMMENT ON COLUMN public.apt_sync_runs.kapt_detail_error_count IS
  'K-apt individual detail API calls that raised an error in this sync.';
COMMENT ON COLUMN public.apt_sync_runs.kapt_address_missing_count IS
  'Complexes still lacking a supported parcel address after existing-field preservation.';

-- The old number parser converted empty upstream strings to Number("") === 0.
-- Null expresses the actual missing/unknown state in both source and derived
-- tables. This never changes a government sale record or a nonzero household count.
UPDATE public.apt_complexes SET households=NULL WHERE households=0;
UPDATE public.apt_candidate_snapshots SET households=NULL WHERE households=0;
