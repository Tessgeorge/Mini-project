import {
  loadAllocationTeams,
  loadMentors,
  loadReviewStages,
  saveAllocationTeams,
  saveMentors,
  saveReviewStages,
} from "./adminStorage";

// Data provider adapter layer.
// Future: replace local provider with Supabase provider without changing page logic.
const localProvider = {
  async getSnapshot() {
    return {
      mentors: loadMentors(),
      teams: loadAllocationTeams(),
      reviewStages: loadReviewStages(),
    };
  },
  async saveMentorsData(mentors) {
    saveMentors(mentors);
  },
  async saveTeamsData(teams) {
    saveAllocationTeams(teams);
  },
  async saveReviewStagesData(stages) {
    saveReviewStages(stages);
  },
};

export const adminRepository = localProvider;
