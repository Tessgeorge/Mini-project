import { supabaseAdmin } from '../config/supabase.js';

const supabase = supabaseAdmin;

export const getGuideTeams = async (req, res) => {
    try {
        const guideId = req.user.id;

        // Fetch projects assigned to this guide
        const { data: projects, error: projectsError } = await supabase
            .from('projects')
            .select(`
        id, 
        title, 
        team_name,
        team_members ( student_id ),
        status
      `)
            .or(`guide_id.eq.${guideId},mentor_id.eq.${guideId}`);

        if (projectsError) throw projectsError;
        if (!projects || projects.length === 0) {
            return res.json([]);
        }

        const projectIds = projects.map(p => p.id);

        // Fetch existing guide marks for these projects by this guide
        const { data: marks, error: marksError } = await supabase
            .from('guide_marks')
            .select('team_id, student_id, marks')
            .eq('guide_id', guideId)
            .in('team_id', projectIds);

        if (marksError) throw marksError;

        // Group marks by project for progress tracking
        const marksByTeam = marks.reduce((acc, row) => {
            if (!acc[row.team_id]) acc[row.team_id] = new Set();
            if (row.marks !== null && row.marks !== undefined) {
                acc[row.team_id].add(row.student_id);
            }
            return acc;
        }, {});

        const enrichedTeams = projects.map(proj => {
            const totalStudents = proj.team_members?.length || 0;
            const evaluatedStudents = marksByTeam[proj.id]?.size || 0;

            let evalStatus = 'Pending';
            if (evaluatedStudents > 0 && evaluatedStudents < totalStudents) {
                evalStatus = 'In Progress';
            } else if (evaluatedStudents > 0 && evaluatedStudents === totalStudents) {
                evalStatus = 'Completed';
            }

            return {
                team_id: proj.id,
                title: proj.title || proj.team_name,
                total_students: totalStudents,
                evaluated_students: evaluatedStudents,
                evaluation_status: evalStatus,
                project_status: proj.status
            };
        });

        res.json(enrichedTeams);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getGuideTeam = async (req, res) => {
    try {
        const guideId = req.user.id;
        const teamId = req.params.team_id;

        // Fetch team details and members
        const { data: team, error: teamError } = await supabase
            .from('projects')
            .select(`
        id, 
        title, 
        team_name,
        team_members (
          student_id,
          profiles:student_id ( id, full_name, roll_number )
        )
      `)
            .eq('id', teamId)
            .single();

        if (teamError) throw teamError;
        if (!team) return res.status(404).json({ message: 'Team not found' });

        // Ensure the guide is assigned to this team
        const { data: projectCheck } = await supabase
            .from('projects')
            .select('id')
            .eq('id', teamId)
            .or(`guide_id.eq.${guideId},mentor_id.eq.${guideId}`)
            .single();

        if (!projectCheck) {
            return res.status(403).json({ message: 'Not authorized to evaluate this team' });
        }

        // Fetch existing guide marks
        const { data: marks, error: marksError } = await supabase
            .from('guide_marks')
            .select('*')
            .eq('guide_id', guideId)
            .eq('team_id', teamId);

        if (marksError) throw marksError;

        const marksMap = marks.reduce((acc, row) => {
            acc[row.student_id] = row;
            return acc;
        }, {});

        // Ensure we handle single or array of profiles due to join structure possibly being array
        const studentList = team.team_members.map(tm => {
            const profile = Array.isArray(tm.profiles) ? tm.profiles[0] : tm.profiles;
            const studentMark = marksMap[tm.student_id] || {};

            return {
                student_id: tm.student_id,
                full_name: profile?.full_name || 'Unknown',
                roll_number: profile?.roll_number || 'Unknown',
                marks: studentMark.marks ?? '', // ensure empty implies no mark
                feedback: studentMark.feedback || '',
                is_finalized: studentMark.is_finalized || false
            };
        });

        res.json({
            team_id: team.id,
            title: team.title || team.team_name,
            students: studentList
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const saveGuideMarks = async (req, res) => {
    try {
        const guideId = req.user.id;
        const { team_id, marks_data } = req.body; // marks_data: array of { student_id, marks, feedback }

        if (!team_id || !Array.isArray(marks_data)) {
            return res.status(400).json({ message: 'Invalid data format' });
        }

        // Check if marks are finalized
        const { data: existingMarks, error: emError } = await supabase
            .from('guide_marks')
            .select('is_finalized')
            .eq('guide_id', guideId)
            .eq('team_id', team_id)
            .limit(1);

        if (!emError && existingMarks && existingMarks.length > 0 && existingMarks[0].is_finalized) {
            return res.status(400).json({ message: 'Marks are already finalized and cannot be edited.' });
        }

        // Prepare upsert payload
        const payload = marks_data.map(m => {
            // Validate marks (0-15)
            let parsedMarks = m.marks === '' ? null : parseInt(m.marks, 10);
            if (parsedMarks !== null && (isNaN(parsedMarks) || parsedMarks < 0 || parsedMarks > 15)) {
                throw new Error(`Invalid marks ${m.marks} for student ${m.student_id}. Must be between 0 and 15.`);
            }

            return {
                team_id,
                student_id: m.student_id,
                guide_id: guideId,
                marks: parsedMarks,
                feedback: m.feedback || null,
                updated_at: new Date().toISOString()
            };
        });

        // We can use Supabase upsert
        // Needs a unique constraint to work effectively ON CONFLICT
        // For now we will delete and insert, or use upsert if they have a unique constraint
        const { data, error } = await supabase
            .from('guide_marks')
            .upsert(payload, { onConflict: 'team_id,student_id,guide_id' });

        if (error) throw error;

        res.json({ message: 'Marks saved successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
