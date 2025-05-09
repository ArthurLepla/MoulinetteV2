"/DataService/anchor/v1/aspecttypes": {
            "post": {
                "tags": [
                    "Anchor AspectTypes"
                ],
                "summary": "Creates an aspect type.",
                "description": "All depending types must be known to the system. AttributeTypes are always defined along with an aspect or aspect. An already existing attribute type can be re-used. If the ID of an rerfered type is known, no additional information needs to be transported. Aside from this, definitions can always be complete (identifier and additional information), but the system must check if the definition is identical to the already known one.",
                "requestBody": {
                    "description": "JSON document of the AspectType to be created. Missing $anchor-identifiers will automatically be created. `$concept` (if present) must be set to value `aspect`.",
                    "content": {
                        "application/json": {
                            "schema": {
                                "$ref": "#/components/schemas/EntityType"
                            }
                        }
                    },
                    "required": true
                },
                "responses": {
                    "201": {
                        "description": "JSON document of the newly created AspectType instance serialized according to schema `EntityType`.",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/EntityType"
                                }
                            }
                        }
                    },
                    "304": {
                        "$ref": "#/components/responses/DataNotModified"
                    },
                    "400": {
                        "$ref": "#/components/responses/RequestMalformed"
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "405": {
                        "$ref": "#/components/responses/MethodNotAllowed"
                    },
                    "410": {
                        "$ref": "#/components/responses/ResourceGone"
                    },
                    "415": {
                        "$ref": "#/components/responses/UnsupportedMediaType"
                    },
                    "422": {
                        "$ref": "#/components/responses/UnprocessableEntity"
                    },
                    "429": {
                        "$ref": "#/components/responses/RequestRejected"
                    },
                    "500": {
                        "$ref": "#/components/responses/InternalError"
                    }
                }
            },
            "get": {
                "tags": [
                    "Anchor AspectTypes"
                ],
                "summary": "Returns all aspect types.",
                "description": "Returns all aspect types.",
                "parameters": [
                    {
                        "name": "namefilter",
                        "in": "query",
                        "description": "one or multiple filter statements. Default: `*`",
                        "schema": {
                            "type": "string",
                            "default": ""
                        }
                    },
                    {
                        "name": "typefilter",
                        "in": "query",
                        "description": "UUID of the AspectType the response has to match or be inherited from. Default: Empty, filter not active.",
                        "schema": {
                            "type": "string",
                            "format": "uuid"
                        }
                    },
                    {
                        "name": "reference",
                        "in": "query",
                        "description": "UUID of the anchor **after** which the result set shall start. Default: Empty, start with the first entry.",
                        "schema": {
                            "type": "string",
                            "format": "uuid"
                        }
                    },
                    {
                        "name": "offset",
                        "in": "query",
                        "description": "Maximum offset of entries with respect to the provided reference. Default: `0`",
                        "schema": {
                            "type": "integer",
                            "format": "int32",
                            "default": 0
                        }
                    },
                    {
                        "name": "take",
                        "in": "query",
                        "description": "Maximum number of entries in the result. Default: `20`",
                        "schema": {
                            "type": "integer",
                            "format": "int32",
                            "default": 20
                        }
                    },
                    {
                        "name": "expanded",
                        "in": "query",
                        "description": "Sub aspect types or aspect types within attributes shall be automatically expanded and serialized along. Default: `false`",
                        "schema": {
                            "type": "boolean",
                            "default": true
                        }
                    },
                    {
                        "name": "includeInherited",
                        "in": "query",
                        "description": "Includes attributes of types which the actual aspect type inherits from. Default: `true`",
                        "schema": {
                            "type": "boolean",
                            "default": true
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "JSON document with array of AspectType instances serialized according to schema `EntityType`. `$concept` (if present) is always set to value `aspect`.",
                        "headers": {
                            "x-anchor-position": {
                                "description": "Position of the anchor provided as reference.",
                                "schema": {
                                    "type": "integer",
                                    "description": "Position of the anchor provided as reference.",
                                    "format": ""
                                }
                            },
                            "x-anchor-count": {
                                "description": "Overall count of results.",
                                "schema": {
                                    "type": "integer",
                                    "description": "Overall count of results.",
                                    "format": ""
                                }
                            }
                        },
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "array",
                                    "items": {
                                        "$ref": "#/components/schemas/EntityType"
                                    }
                                }
                            }
                        }
                    },
                    "304": {
                        "$ref": "#/components/responses/DataNotModified"
                    },
                    "400": {
                        "$ref": "#/components/responses/RequestMalformed"
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "405": {
                        "$ref": "#/components/responses/MethodNotAllowed"
                    },
                    "410": {
                        "$ref": "#/components/responses/ResourceGone"
                    },
                    "415": {
                        "$ref": "#/components/responses/UnsupportedMediaType"
                    },
                    "422": {
                        "$ref": "#/components/responses/UnprocessableEntity"
                    },
                    "429": {
                        "$ref": "#/components/responses/RequestRejected"
                    },
                    "500": {
                        "$ref": "#/components/responses/InternalError"
                    }
                }
            }
        }