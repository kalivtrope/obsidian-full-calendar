import { EventApi, EventInput, EventSourceInput } from "@fullcalendar/core";
import { MetadataCache, TFile, TFolder, Vault } from "obsidian";
import { getDate, getTime } from "./dateUtil";
import {
	eventApiToFrontmatter,
	modifyFrontmatter,
	parseFrontmatter,
} from "./frontmatter";
import { CalendarSource, EventFrontmatter, LocalCalendarSource } from "./types";

export async function getFileForEvent(
	vault: Vault,
	event: EventApi
): Promise<TFile | null> {
	let filename = event.id;
	let file = vault.getAbstractFileByPath(filename);
	if (file instanceof TFile) {
		return file;
	}
	return null;
}

export function getFrontmatterFromFile(
	cache: MetadataCache,
	file: TFile
): EventFrontmatter | null {
	return (
		(cache.getFileCache(file)?.frontmatter as
			| EventFrontmatter
			| undefined) || null
	);
}

export async function getFrontmatterFromEvent(
	vault: Vault,
	cache: MetadataCache,
	event: EventApi
): Promise<EventFrontmatter | null> {
	let file = await getFileForEvent(vault, event);
	if (!file) {
		return null;
	}
	return getFrontmatterFromFile(cache, file);
}

export async function updateEventFromCalendar(
	vault: Vault,
	event: EventApi
): Promise<void> {
	const file = await getFileForEvent(vault, event);
	if (!file) {
		return;
	}
	await modifyFrontmatter(vault, file, eventApiToFrontmatter(event));
}

export function getEventInputFromFile(
	cache: MetadataCache,
	file: TFile
): EventInput | null {
	let frontmatter = getFrontmatterFromFile(cache, file);
	if (!frontmatter) return null;
	if (!frontmatter.title) {
		frontmatter.title = file.basename;
	}
	return parseFrontmatter(file.path, frontmatter);
}

export async function upsertEvent(
	vault: Vault,
	event: EventFrontmatter,
	filename: string
): Promise<TFile | null> {
	let file = vault.getAbstractFileByPath(filename);
	if (!file) {
		file = await vault.create(filename, "");
	}
	if (file instanceof TFile) {
		await modifyFrontmatter(vault, file, event);
		return file;
	}

	return null;
}

export function dateEndpointsToFrontmatter(
	start: Date,
	end: Date,
	allDay: boolean
): Partial<EventFrontmatter> {
	return {
		type: "single",
		date: getDate(start),
		allDay,
		...(allDay
			? {}
			: {
					startTime: getTime(start),
					endTime: getTime(end),
			  }),
	};
}

export async function getEventInputFromPath(
	vault: Vault,
	cache: MetadataCache,
	path: string,
	recursive?: boolean
): Promise<EventInput[] | null> {
	const eventFolder = vault.getAbstractFileByPath(path);
	if (!(eventFolder instanceof TFolder)) {
		return null;
	}

	let events: EventInput[] = [];
	for (let file of eventFolder.children) {
		if (file instanceof TFile) {
			let event = getEventInputFromFile(cache, file);
			if (event) {
				events.push(event);
			}
		} else if (recursive) {
			const childEvents = await getEventInputFromPath(
				vault,
				cache,
				file.path,
				recursive
			);
			if (childEvents) {
				events.push(...childEvents);
			}
		}
	}
	return events;
}

export async function getEventSourceFromLocalSource(
	vault: Vault,
	cache: MetadataCache,
	calendarSource: LocalCalendarSource,
	recursive: boolean
): Promise<EventSourceInput | null> {
	if (!calendarSource.directory) {
		return null;
	}
	const events = await getEventInputFromPath(
		vault,
		cache,
		calendarSource.directory,
		recursive
	);
	if (!events) {
		return null;
	}

	return {
		events,
		textColor: getComputedStyle(document.body).getPropertyValue(
			"--text-on-accent"
		),
		color:
			calendarSource.color ||
			getComputedStyle(document.body).getPropertyValue(
				"--interactive-accent"
			),
	};
}
