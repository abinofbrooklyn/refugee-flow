import React from 'react';

export interface AccordionContent {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export interface AccordionDefinition {
  name: string;
  isClosed: boolean;
  contents: AccordionContent[];
}

const qaTitleStyle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 400,
  lineHeight: 2,
};

export const accordions: AccordionDefinition[] = [
  {
    name: 'MISSION',
    isClosed: false,
    contents: [
      { children: 'Refugee Flow uses compelling visual design with comprehensive data to humanize the perilous transformation of the refugee.',
      },
    ],
  },
  {
    name: 'VISION',
    isClosed: true,
    contents: [
      { children: "Refugee Flow's vision is for all people to live to their fullest potential without threat of violence and for all people to understand each person's inherent dignity.",
      },
    ],
  },
  {
    name: 'PROJECT TEAM',
    isClosed: false,
    contents: [
      {
        children: (
          <>
            <em>
              <a target="_blank" rel="noopener noreferrer" href="https://www.linkedin.com/in/will-su">Will Su - Co-Creator</a>
            </em>
            &nbsp;
            rides the line between design and technology.
            His work focuses on presenting data efficiently and beautifully with fluid interactivity.
            He has received awards from
            &nbsp;
            <a target="_blank" rel="noopener noreferrer" href="https://www.informationisbeautifulawards.com/showcase/2348-nyc-foodiverse">Information is Beautiful</a>
            ,
            &nbsp;
            <a target="_blank" rel="noopener noreferrer" href="https://www.awwwards.com/sites/nyc-foodiverse">Awwwards</a>
            &nbsp;
            and placed first at the
            &nbsp;
            <a target="_blank" rel="noopener noreferrer" href="https://medium.com/@nycmedialab/prototyping-teams-win-12-000-in-prizes-at-mlbam-hackathon-organized-by-nyc-media-lab-d9fee4c7ccaf">MLB Advanced Media Hackathon</a>
            . He speaks regularly at
            &nbsp;
            <a target="_blank" rel="noopener noreferrer" href="https://www.meetup.com/UX-Support-Group/events/248956066/">Meetups</a>
            &nbsp;
            and
            &nbsp;
            <a target="_blank" rel="noopener noreferrer" href="https://dnnsociety.org/2018/01/01/from-graphic-designer-to-data-visualisation-specialist-a-sharing-from-will-su/">universities</a>
            &nbsp;
            about his learning path and perspective on data visualization.
          </>
        ),
      },
      {
        children: (
          <>
            <em>
              <a target="_blank" rel="noopener noreferrer" href='https://www.linkedin.com/in/abins'>Abin Abraham - Co-Creator</a>
            </em>
            &nbsp;
            is a technical leader who builds and manages complex systems while helping others
            understand them. With a background spanning software engineering, cybersecurity,
            and enterprise platforms, he is drawn to distilling complexity into clarity,
            whether through data, design, or narrative. He believes technology reaches its
            highest purpose when it serves the common good.
          </>
        ),
      },
      {
        style: { fontSize: '17px', fontWeight: '800', margin: 0 } as React.CSSProperties,
        children: (
          <>
            <em>If you have any questions or feedback, please contact</em>
            &nbsp;
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="mailto:refugeeflow@gmail.com"
              style={{ fontSize: '17px', fontWeight: '200', margin: 0, marginLeft: '8px', fontStyle: 'italic' }}
            >
              refugeeflow@gmail.com
            </a>
          </>
        ),
      },
    ],
  },
  {
    name: 'Q & A',
    isClosed: true,
    contents: [
      { children: 'What is Refugee Flow?',
        style: qaTitleStyle,
      },
      { children: 'Refugee Flow is an interactive visualization that brings together conflict data, migration routes, and asylum statistics to help users understand the global displacement crisis. It combines multiple authoritative datasets into one explorable experience.',
      },

      { children: 'How can design and technology help find solutions in migration?',
        style: qaTitleStyle,
      },
      { children: 'Facts alone rarely move people to act. Refugee Flow merges design and technology to present displacement data in ways that resonate on a human level. By making the crisis tangible and explorable, we believe users can develop a deeper understanding that drives better conversations and better solutions.',
      },

      { children: 'What makes your team unique for this project?',
        style: qaTitleStyle,
      },
      { children: 'Will brings the creative mind of a designer who turns complex information into compelling visual experiences. Abin brings a systems engineering background with a focus on distilling complexity into clarity. Together, they combine design thinking with technical depth to build something that neither could alone.',
      },

      { children: 'What does Refugee Flow do differently than existing datasets?',
        style: qaTitleStyle,
      },
      { children: 'Most displacement dashboards show static charts and summary statistics. Refugee Flow lets users explore the data themselves. You can rotate a 3D globe of conflict events, trace migration routes, examine deaths along those routes on a case-by-case basis, and see asylum trends over time. It turns data into an experience.',
      },

      { children: 'Who can use Refugee Flow and how?',
        style: qaTitleStyle,
      },
      { children: 'Anyone. Refugee Flow is built for the person who has heard about the crisis but wants to understand it more deeply. No background in data or policy is needed.',
      },

      { children: 'Why is Refugee Flow important?',
        style: qaTitleStyle,
      },
      { children: 'By mid-2024, over 120 million people were forcibly displaced worldwide, nearly double the figure from 2017. Climate change, armed conflict, and political instability continue to accelerate displacement. Understanding the scale and human cost of this crisis is a prerequisite for meaningful action. Refugee Flow is a call to that understanding.',
      },
    ],
  },
  {
    name: 'Data Sources',
    isClosed: true,
    contents: [
      {
        children: (
          <>
            &#8226;
            &nbsp;
            <em>
              <a target="_blank" rel="noopener noreferrer" href="https://www.unhcr.org/refugee-statistics/download/">UNHCR Refugee Data Finder</a>
            </em>
            &nbsp;
            provides global asylum application data by country of origin and destination. Refugee Flow uses UNHCR annual totals from 2010 to present, covering asylum seekers, refugees, and other populations of concern worldwide.
          </>
        ),
      },
      {
        children: (
          <>
            &#8226;
            &nbsp;
            <em>
              <a target="_blank" rel="noopener noreferrer" href='https://missingmigrants.iom.int/downloads'>Missing Migrants Project</a>
            </em>
            &nbsp;
            tracks deaths of migrants, including refugees and asylum-seekers, who have died or gone missing in the process of migration towards an international destination.
          </>
        ),
      },
      {
        children: (
          <>
            &#8226;
            &nbsp;
            <em>
              <a target="_blank" rel="noopener noreferrer" href='http://www.themigrantsfiles.com/'>The Migrants Files</a>
            </em>
            &nbsp;
            is a consortium of journalists from over 10 EU countries. It is coordinated by Journalism++.
          </>
        ),
      },
      {
        children: (
          <>
            &#8226;
            &nbsp;
            <em>
              <a target="_blank" rel="noopener noreferrer" href='https://frontex.europa.eu/along-eu-borders/migratory-map/'>Frontex</a>
            </em>
            &nbsp;
            the European Border and Coast Guard Agency, promotes, coordinates and develops European border management in line with the EU fundamental rights charter and the concept of Integrated Border Management. To help identify migratory patterns as well as trends in cross-border criminal activities, Frontex analyses data related to the situation at and beyond EU's external borders.
          </>
        ),
      },
      {
        children: (
          <>
            &#8226;
            &nbsp;
            <em>
              <a target="_blank" rel="noopener noreferrer" href='https://www.acleddata.com/data/'>ACLED</a>
            </em>
            &nbsp;
            (Armed Conflict Location & Event Data) is a disaggregated conflict analysis and crisis mapping project. ACLED is the highest quality, most widely used, realtime data and analysis source on political violence and protest in the developing world. Practitioners, researchers and governments depend on ACLED for the latest reliable information on current conflict and disorder patterns.
          </>
        ),
      },
      {
        children: (
          <>
            &#8226;
            &nbsp;
            <em>
              <a target="_blank" rel="noopener noreferrer" href='https://ec.europa.eu/eurostat/web/migration-asylum/asylum/database'>Eurostat</a>
            </em>
            &nbsp;
            provides monthly asylum application statistics for EU/EEA countries. Quarterly breakdowns for non-EU destinations are estimated using Eurostat seasonal distribution patterns applied to UNHCR annual totals.
          </>
        ),
      },
      {
        children: (
          <>
            &#8226;
            &nbsp;
            <em>
              <a target="_blank" rel="noopener noreferrer" href='https://www.cbp.gov/newsroom/stats/nationwide-encounters'>U.S. Customs and Border Protection</a>
            </em>
            &nbsp;
            (CBP) publishes monthly encounter statistics for U.S. land borders. Refugee Flow uses Title 8 U.S. Border Patrol apprehension data for the Americas route, aggregated quarterly by nationality. CBP data covers FY2020 (October 2019) to present. Pre-2020 data is not available in machine-readable format.
          </>
        ),
      },
      {
        children: (
          <>
            &#8226;
            &nbsp;
            <em>
              <a target="_blank" rel="noopener noreferrer" href='https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables'>UK Home Office</a>
            </em>
            &nbsp;
            publishes quarterly statistics on irregular entry routes to the UK. Refugee Flow uses small boat arrival data for the English Channel route, aggregated by nationality. Data covers 2018 Q1 to present.
          </>
        ),
      },
    ],
  },
];

export const accordionsDefaultVisibility = accordions.reduce<Record<string, { isClosed: boolean }>>((acc, accordion) => ({
  ...acc,
  [accordion.name]: { isClosed: accordion.isClosed },
}), {});
