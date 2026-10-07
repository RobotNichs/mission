export type SourceProject = {projectId:string;phaseId?:string;milestoneIds?:string[]}
export function validateSourceProject(v:unknown):v is SourceProject
export function readSourceProject(v:unknown):SourceProject | undefined
