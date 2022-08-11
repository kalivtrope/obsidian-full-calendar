import FullCalendarPlugin from "./main";
import {
	App,
	DropdownComponent,
	Notice,
	PluginSettingTab,
	Setting,
	TFolder,
	Vault,
} from "obsidian";
import {
	makeDefaultPartialCalendarSource,
	CalendarSource,
	FCError,
} from "./types";
import { CalendarSettings } from "./components/CalendarSetting";
import { AddCalendarSource } from "./components/AddCalendarSource";
import { RemoteSource } from "./models/RemoteSource";
import * as ReactDOM from "react-dom";
import { createElement, useState } from "react";
import { ReactModal } from "./modal";

export interface FullCalendarSettings {
	calendarSources: CalendarSource[];
	defaultCalendar: number;
	recursiveLocal: boolean;
	firstDay: number;
	defaultCalendarView: string;
	calendarViewPersistency: boolean;
	initialDate: Date;
}

export const DEFAULT_SETTINGS: FullCalendarSettings = {
	calendarSources: [],
	defaultCalendar: 0,
	recursiveLocal: false,
	firstDay: 0,
	defaultCalendarView: "",
	calendarViewPersistency: false,
	initialDate: new Date(),
};

const WEEKDAYS = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

const VIEWS = [
	"timeGridDay",
	"timeGrid3Days",
	"timeGridWeek",
	"listWeek",
	"dayGridMonth",
];

export function addCalendarButton(
	app: App,
	plugin: FullCalendarPlugin,
	containerEl: HTMLElement,
	submitCallback: (setting: CalendarSource) => void,
	listUsedDirectories?: () => string[]
) {
	let dropdown: DropdownComponent;
	const directories = app.vault
		.getAllLoadedFiles()
		.filter((f) => f instanceof TFolder)
		.map((f) => f.path);

	return new Setting(containerEl)
		.setName("Calendars")
		.setDesc("Add calendar")
		.addDropdown(
			(d) =>
				(dropdown = d.addOptions({
					local: "Local",
					icloud: "iCloud",
					caldav: "CalDAV",
					ical: "Remote (.ics format)",
				}))
		)
		.addExtraButton((button) => {
			button.setTooltip("Add Calendar");
			button.setIcon("plus-with-circle");
			button.onClick(() => {
				let modal = new ReactModal(app, async () => {
					await plugin.loadSettings();
					const usedDirectories = (
						listUsedDirectories
							? listUsedDirectories
							: () =>
									plugin.settings.calendarSources
										.map(
											(s) =>
												s.type === "local" &&
												s.directory
										)
										.filter((s): s is string => !!s)
					)();

					return createElement(AddCalendarSource, {
						source: makeDefaultPartialCalendarSource(
							dropdown.getValue() as CalendarSource["type"]
						),
						directories: directories.filter(
							(dir) => usedDirectories.indexOf(dir) === -1
						),
						submit: async (source: CalendarSource) => {
							if (
								source.type === "caldav" ||
								source.type === "icloud"
							) {
								let sources = await new RemoteSource(
									source
								).importCalendars();
								if (sources instanceof FCError) {
									new Notice(sources.message);
								} else {
									sources.forEach((source) =>
										submitCallback(source)
									);
								}
							} else {
								submitCallback(source);
							}
							modal.close();
						},
					});
				});
				modal.open();
			});
		});
}

export class FullCalendarSettingTab extends PluginSettingTab {
	plugin: FullCalendarPlugin;

	constructor(app: App, plugin: FullCalendarPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	async display(): Promise<void> {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Events settings" });

		new Setting(containerEl)
			.setName("Recursive event folders")
			.setDesc("Search through sub-folders for events")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.recursiveLocal);
				toggle.onChange(async (val) => {
					this.plugin.settings.recursiveLocal = val;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Starting Day of the Week")
			.setDesc("Choose what day of the week to start.")
			.addDropdown((dropdown) => {
				WEEKDAYS.forEach((day, code) => {
					dropdown.addOption(code.toString(), day);
				});
				dropdown.setValue(this.plugin.settings.firstDay.toString());
				dropdown.onChange(async (codeAsString) => {
					this.plugin.settings.firstDay = Number(codeAsString);
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Calendar view persistency")
			.setDesc("Reopen the calendar in last used view")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.calendarViewPersistency);
				toggle.onChange(async (val) => {
					this.plugin.settings.calendarViewPersistency = val;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Default calendar view")
			.setDesc("Choose the default calendar view")
			.addDropdown((dropdown) => {
				VIEWS.forEach((view, index) => {
					dropdown.addOption(index.toString(), view);
				});
				dropdown.setValue(
					VIEWS.indexOf(
						this.plugin.settings.defaultCalendarView
					).toString()
				);
				dropdown.onChange(async (index) => {
					this.plugin.settings.defaultCalendarView =
						VIEWS[Number(index)];
					await this.plugin.saveSettings();
				});
			});

		addCalendarButton(
			this.app,
			this.plugin,
			containerEl,
			async (source: CalendarSource) => {
				sourceList.addSource(source);
			},
			() =>
				sourceList.state.sources
					.map((s) => s.type === "local" && s.directory)
					.filter((s): s is string => !!s)
		);

		const sourcesDiv = containerEl.createDiv();
		sourcesDiv.style.display = "block";
		let sourceList = ReactDOM.render(
			createElement(CalendarSettings, {
				sources: this.plugin.settings.calendarSources,
				submit: async (settings: CalendarSource[]) => {
					this.plugin.settings.calendarSources = settings;
					await this.plugin.saveSettings();
				},
			}),
			sourcesDiv
		);
	}
}
