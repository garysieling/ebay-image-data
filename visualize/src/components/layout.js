import React from 'react'
import PropTypes from 'prop-types'
import Helmet from 'react-helmet'
import { StaticQuery, graphql } from 'gatsby'
import _ from 'lodash'

import Header from './header'
import './layout.css'

const Layout = ({ children }) => (
  <StaticQuery
    query={graphql`
      query SiteTitleQuery {
        site {
          siteMetadata {
            title
          }
        }

        allFile {
          edges {
            node {
              extension
              dir
              name
              root
              relativeDirectory
            }
          }
        }
      }
    `}
    render={data => (
      <>
        <Helmet
          title={data.site.siteMetadata.title}
          meta={[
            { name: 'description', content: 'Sample' },
            { name: 'keywords', content: 'sample, something' },
          ]}
        >
          <html lang="en" />
        </Helmet>
        <Header siteTitle={data.site.siteMetadata.title} />
        <ul>
        {   
          _.reverse(
            _.orderBy(     
              _.toPairs(
                _.countBy(
                  data.allFile.edges.filter(
                    ({node}) => 
                      node.relativeDirectory.startsWith("tagged/")
                  ).map(
                    ({node}) => node.relativeDirectory.substring("tagged".length + 1)
                  )
                )
              ),
              1
            )
          ).map(
            ([token, count]) => 
              count <= 100 ? 
                (<li style={{color: "red"}}>{token} ({count})</li>) :
                (<li>{token} ({count})</li>)                
          )
        }
        </ul>
        <div
          style={{
            margin: '0 auto',
            maxWidth: 960,
            padding: '0px 1.0875rem 1.45rem',
            paddingTop: 0,
          }}
        >
          {children}
        </div>
      </>
    )}
  />
)

Layout.propTypes = {
  children: PropTypes.node.isRequired,
}

export default Layout
